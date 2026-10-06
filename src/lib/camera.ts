export interface CameraCapabilities {
  torchSupported: boolean;
  zoomSupported: boolean;
  zoomMin: number;
  zoomMax: number;
  zoomStep: number;
  focusModeSupported: boolean;
  focusModes: string[];
  pointsOfInterestSupported: boolean;
}

export interface ActiveCamera {
  stream: MediaStream;
  track: MediaStreamTrack | null;
  caps: CameraCapabilities;
}

interface ZoomCaps {
  min: number;
  max: number;
  step: number;
}

interface ExtMediaTrackCapabilities extends MediaTrackCapabilities {
  zoom?: ZoomCaps;
  torch?: boolean | boolean[];
  focusMode?: string[];
  pointsOfInterest?: boolean;
}

export function clampZoom(value: number, min: number, max: number, step: number): number {
  if (min === max) return min;
  const snapped = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

function readCapabilities(track: MediaStreamTrack | null): CameraCapabilities {
  if (!track || typeof track.getCapabilities !== 'function') {
    return {
      torchSupported: false,
      zoomSupported: false,
      zoomMin: 1,
      zoomMax: 1,
      zoomStep: 0.1,
      focusModeSupported: false,
      focusModes: [],
      pointsOfInterestSupported: false,
    };
  }
  const caps = track.getCapabilities() as ExtMediaTrackCapabilities;
  const zoom = caps?.zoom;
  const torch = caps?.torch;
  const focusModes = Array.isArray(caps?.focusMode) ? caps.focusMode : [];
  return {
    torchSupported: Array.isArray(torch) || torch === true,
    zoomSupported: !!zoom && typeof zoom === 'object',
    zoomMin: zoom?.min ?? 1,
    zoomMax: zoom?.max ?? 1,
    zoomStep: zoom?.step ?? 0.1,
    focusModeSupported: focusModes.length > 0,
    focusModes,
    pointsOfInterestSupported: Boolean(caps?.pointsOfInterest),
  };
}

export async function startCamera(video: HTMLVideoElement): Promise<ActiveCamera> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  const track = stream.getVideoTracks()[0] ?? null;
  return { stream, track, caps: readCapabilities(track) };
}

export function stopCamera(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
}

export async function setTorch(camera: ActiveCamera, on: boolean): Promise<void> {
  if (!camera.track || !camera.caps.torchSupported) return;
  try {
    await camera.track.applyConstraints({
      advanced: [{ torch: Boolean(on) } as unknown as MediaTrackConstraintSet],
    });
  } catch {
    try {
      await camera.track.applyConstraints({
        advanced: on ? ([{ torch: true } as unknown as MediaTrackConstraintSet]) : [],
      });
    } catch (err) {
      console.warn('Falha ao alternar lanterna:', err);
    }
  }
}

export async function setZoom(camera: ActiveCamera, value: number): Promise<number> {
  const { track, caps } = camera;
  if (!track || !caps.zoomSupported) return 1;
  const next = clampZoom(value, caps.zoomMin, caps.zoomMax, caps.zoomStep);
  await track.applyConstraints({
    advanced: [{ zoom: next } as unknown as MediaTrackConstraintSet],
  });
  return next;
}

export function captureFrame(video: HTMLVideoElement, maxW = 1280): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const { videoWidth, videoHeight } = video;
    if (!videoWidth || !videoHeight) {
      reject(new Error('Câmera não pronta'));
      return;
    }
    const scale = Math.min(1, maxW / videoWidth);
    const w = Math.max(1, Math.round(videoWidth * scale));
    const h = Math.max(1, Math.round(videoHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Sem canvas'));
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (b) => {
        canvas.width = 0;
        canvas.height = 0;
        if (b) resolve(b);
        else reject(new Error('Falha ao capturar'));
      },
      'image/jpeg',
      0.72,
    );
  });
}

/**
 * Define o ponto de foco da câmera via toque/clique (coordenadas normalizadas 0..1).
 * Implementa Progressive Enhancement com fallback se pointsOfInterest não for suportado.
 */
export async function setFocusPoint(
  camera: ActiveCamera,
  point?: { x: number; y: number },
): Promise<boolean> {
  const { track } = camera;
  if (!track || typeof track.applyConstraints !== 'function') return false;

  const normX = point ? Math.max(0, Math.min(1, point.x)) : 0.5;
  const normY = point ? Math.max(0, Math.min(1, point.y)) : 0.5;

  // 1. Tentar W3C ImageCapture pointsOfInterest se suportado
  try {
    await track.applyConstraints({
      advanced: [
        {
          pointsOfInterest: [{ x: normX, y: normY }],
          focusMode: 'continuous',
        } as unknown as MediaTrackConstraintSet,
      ],
    });
    return true;
  } catch {
    // 2. Fallback: aciona ciclo single-shot / continuous de foco
    try {
      await track.applyConstraints({
        advanced: [{ focusMode: 'single-shot' } as unknown as MediaTrackConstraintSet],
      });
      setTimeout(() => {
        void track.applyConstraints({
          advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
        }).catch(() => {});
      }, 400);
      return true;
    } catch {
      try {
        await track.applyConstraints({
          advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
        });
        return true;
      } catch {
        return false;
      }
    }
  }
}

/**
 * Dispara re-foco automático no centro do quadro.
 */
export async function triggerAutoFocus(camera: ActiveCamera): Promise<boolean> {
  return setFocusPoint(camera, { x: 0.5, y: 0.5 });
}

export const SHARPNESS_THRESHOLD = 75;

/**
 * Calcula o índice de nitidez de um ImageData usando a variância do operador Laplaciano 3x3.
 * Valores maiores indicam contornos nítidos (foco bom); valores baixos indicam imagem borrada/lisa.
 */
export function calculateSharpness(imageData: ImageData): number {
  const { data, width, height } = imageData;
  if (width < 3 || height < 3) return 0;

  // Converter para tons de cinza
  const gray = new Float32Array(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // Operador Laplaciano discreto 3x3
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    const rowPrev = (y - 1) * width;
    const rowNext = (y + 1) * width;

    for (let x = 1; x < width - 1; x++) {
      const center = gray[row + x];
      const lap =
        gray[rowPrev + x] +
        gray[rowNext + x] +
        gray[row + (x - 1)] +
        gray[row + (x + 1)] -
        4 * center;

      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return Math.max(0, variance);
}

/**
 * Avalia se o quadro atinge o limiar mínimo de nitidez.
 */
export function isFrameSharp(imageData: ImageData, threshold = SHARPNESS_THRESHOLD): boolean {
  return calculateSharpness(imageData) >= threshold;
}

/**
 * Avalia rapidamente a nitidez da área central do vídeo da câmera.
 */
export function checkVideoSharpness(video: HTMLVideoElement, sampleSize = 160): number {
  try {
    const { videoWidth, videoHeight } = video;
    if (!videoWidth || !videoHeight) return 0;

    const canvas = document.createElement('canvas');
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 0;

    const srcSize = Math.min(videoWidth, videoHeight) * 0.5;
    const srcX = (videoWidth - srcSize) / 2;
    const srcY = (videoHeight - srcSize) / 2;

    ctx.drawImage(video, srcX, srcY, srcSize, srcSize, 0, 0, sampleSize, sampleSize);
    const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    return calculateSharpness(imgData);
  } catch (err) {
    console.debug('Erro ao verificar nitidez do vídeo:', err);
    return 100;
  }
}


export interface CameraCapabilities {
  torchSupported: boolean;
  zoomSupported: boolean;
  zoomMin: number;
  zoomMax: number;
  zoomStep: number;
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
}

export function clampZoom(value: number, min: number, max: number, step: number): number {
  if (min === max) return min;
  const snapped = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

function readCapabilities(track: MediaStreamTrack | null): CameraCapabilities {
  if (!track || typeof track.getCapabilities !== 'function') {
    return { torchSupported: false, zoomSupported: false, zoomMin: 1, zoomMax: 1, zoomStep: 0.1 };
  }
  const caps = track.getCapabilities() as ExtMediaTrackCapabilities;
  const zoom = caps?.zoom;
  const torch = caps?.torch;
  return {
    torchSupported: Array.isArray(torch) || torch === true,
    zoomSupported: !!zoom && typeof zoom === 'object',
    zoomMin: zoom?.min ?? 1,
    zoomMax: zoom?.max ?? 1,
    zoomStep: zoom?.step ?? 0.1,
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
  await camera.track.applyConstraints({
    advanced: [{ torch: on } as unknown as MediaTrackConstraintSet],
  });
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
      (b) => (b ? resolve(b) : reject(new Error('Falha ao capturar'))),
      'image/jpeg',
      0.7,
    );
  });
}

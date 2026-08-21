import type { Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;
let tesseractModule: typeof import('tesseract.js') | null = null;

async function getTesseract() {
  if (!tesseractModule) {
    tesseractModule = await import('tesseract.js');
  }
  return tesseractModule;
}

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const Tesseract = await getTesseract();
      const w = await Tesseract.createWorker('eng+por', Tesseract.OEM.LSTM_ONLY, {
        logger: () => {},
      });
      await w.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
        tessedit_char_whitelist: '0123456789.,',
        preserve_interword_spaces: '1',
      });
      return w;
    })().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

export interface OcrResult {
  raw: string;
  value: number | null;
  confidence: number;
}

function preprocessImage(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      const cropW = Math.round(w * 0.6);
      const cropH = Math.round(h * 0.35);
      const cropX = Math.round((w - cropW) / 2);
      const cropY = Math.round(h * 0.3);

      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = cropW * scale;
      canvas.height = cropH * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Sem canvas')); return; }

      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        const v = gray > 140 ? 255 : 0;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
      }
      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Falha ao processar'))),
        'image/png',
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Erro ao carregar imagem')); };
    img.src = url;
  });
}

const OCR_REGEX = /[\d]+(?:[.,\-][\d]+)*/g;

function hasDigits(s: string): boolean {
  return /\d/.test(s);
}

function cleanOcrText(raw: string): { text: string; negative: boolean } {
  const negative = /^\s*[-−–]/.test(raw);

  let t = raw;
  if (hasDigits(raw)) {
    t = t.replace(/(?<=\d)[OolISsBbGgZz](?=\d)/g, (m) => {
      switch (m) {
        case 'O': case 'o': return '0';
        case 'l': case 'I': return '1';
        case 'S': case 's': return '5';
        case 'B': case 'b': return '8';
        case 'G': case 'g': return '6';
        case 'Z': case 'z': return '2';
        default: return m;
      }
    });
  }
  t = t.replace(/[^0-9.,]/g, '');

  return { text: t, negative };
}

export function parseOcrNumber(text: string): number | null {
  const { text: cleaned, negative } = cleanOcrText(text);
  const matches = cleaned.match(OCR_REGEX);
  if (!matches || matches.length === 0) return null;

  let best = matches[0];
  for (const m of matches) {
    if (m.length > best.length) best = m;
  }

  const hasComma = /,/.test(best);
  const hasDot = /\./.test(best);

  let normalized: string;
  if (hasComma && hasDot) {
    normalized = best.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = best.replace(',', '.');
  } else if (hasDot) {
    const dotCount = (best.match(/\./g) ?? []).length;
    if (dotCount > 1) {
      normalized = best.replace(/\./g, '');
    } else {
      normalized = best;
    }
  } else {
    normalized = best;
  }

  let value = parseFloat(normalized);
  if (!Number.isFinite(value)) return null;
  if (negative) value = -value;
  if (value < 0 || value > 9999999) return null;
  return value;
}

export async function recognizeMeter(blob: Blob): Promise<OcrResult> {
  const processed = await preprocessImage(blob);
  const worker = await getWorker();
  const result = await worker.recognize(processed);
  const raw = result.data.text.trim();
  const value = parseOcrNumber(raw);
  return { raw, value, confidence: result.data.confidence };
}

export async function terminateOcr(): Promise<void> {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
    tesseractModule = null;
  }
}

export interface BatchOcrResult {
  aptCode: string;
  result: OcrResult;
}

export async function batchRecognizeMeters(
  photos: { aptCode: string; photo: Blob }[],
  onProgress?: (done: number, total: number) => void,
): Promise<BatchOcrResult[]> {
  const results: BatchOcrResult[] = [];
  for (let i = 0; i < photos.length; i++) {
    const { aptCode, photo } = photos[i];
    try {
      const result = await recognizeMeter(photo);
      results.push({ aptCode, result });
    } catch {
      results.push({ aptCode, result: { raw: '', value: null, confidence: 0 } });
    }
    onProgress?.(i + 1, photos.length);
  }
  return results;
}

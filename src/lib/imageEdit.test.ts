import { describe, expect, it, vi } from 'vitest';
import { normalizeRotationAngle, rotateImageBlob } from './imageEdit';

describe('normalizeRotationAngle', () => {
  it('normaliza múltiplos de 90 positivos', () => {
    expect(normalizeRotationAngle(0)).toBe(0);
    expect(normalizeRotationAngle(90)).toBe(90);
    expect(normalizeRotationAngle(180)).toBe(180);
    expect(normalizeRotationAngle(270)).toBe(270);
    expect(normalizeRotationAngle(360)).toBe(0);
    expect(normalizeRotationAngle(450)).toBe(90);
  });

  it('normaliza ângulos negativos', () => {
    expect(normalizeRotationAngle(-90)).toBe(270);
    expect(normalizeRotationAngle(-180)).toBe(180);
    expect(normalizeRotationAngle(-270)).toBe(90);
    expect(normalizeRotationAngle(-360)).toBe(0);
  });

  it('arredonda pequenos desvios', () => {
    expect(normalizeRotationAngle(89.8)).toBe(90);
    expect(normalizeRotationAngle(90.2)).toBe(90);
  });
});

describe('rotateImageBlob', () => {
  it('retorna o mesmo blob quando o ângulo normalizado é 0 ou 360', async () => {
    const fakeBlob = new Blob(['sample data'], { type: 'image/jpeg' });
    const result0 = await rotateImageBlob(fakeBlob, 0);
    expect(result0).toBe(fakeBlob);

    const result360 = await rotateImageBlob(fakeBlob, 360);
    expect(result360).toBe(fakeBlob);
  });

  it('rotaciona via createImageBitmap e canvas quando disponível', async () => {
    const fakeBlob = new Blob(['fake image bytes'], { type: 'image/jpeg' });
    const rotatedMockBlob = new Blob(['rotated bytes'], { type: 'image/jpeg' });

    // Mock createImageBitmap
    const mockBitmap = {
      width: 1280,
      height: 720,
      close: vi.fn(),
    };
    const origCreateImageBitmap = globalThis.createImageBitmap;
    globalThis.createImageBitmap = vi.fn().mockResolvedValue(mockBitmap);

    // Mock document.createElement('canvas')
    const mockCtx = {
      translate: vi.fn(),
      rotate: vi.fn(),
      drawImage: vi.fn(),
    };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
      toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(rotatedMockBlob)),
    };

    const origDoc = (globalThis as unknown as { document?: unknown }).document;
    (globalThis as unknown as { document: unknown }).document = {
      createElement: vi.fn((tagName: string) => {
        if (tagName === 'canvas') {
          return mockCanvas;
        }
        return {};
      }),
    };

    let recordedW = 0;
    let recordedH = 0;
    Object.defineProperty(mockCanvas, 'width', {
      get: () => recordedW,
      set: (v) => {
        recordedW = v;
      },
    });
    Object.defineProperty(mockCanvas, 'height', {
      get: () => recordedH,
      set: (v) => {
        recordedH = v;
      },
    });

    try {
      const result = await rotateImageBlob(fakeBlob, 90);
      expect(result).toBe(rotatedMockBlob);
      expect(mockCtx.translate).toHaveBeenCalledWith(360, 640);
      expect(mockCtx.rotate).toHaveBeenCalledWith((90 * Math.PI) / 180);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(mockBitmap, -640, -360);
      expect(mockBitmap.close).toHaveBeenCalled();
    } finally {
      globalThis.createImageBitmap = origCreateImageBitmap;
      (globalThis as unknown as { document?: unknown }).document = origDoc;
      vi.restoreAllMocks();
    }
  });
});

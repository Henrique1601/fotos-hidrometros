import { describe, expect, it, vi } from 'vitest';
import {
  clampZoom,
  calculateSharpness,
  isFrameSharp,
  setFocusPoint,
  triggerAutoFocus,
  ActiveCamera,
} from './camera';

describe('clampZoom', () => {
  it('clampa dentro dos limites', () => {
    expect(clampZoom(50, 1, 4, 0.1)).toBe(4);
    expect(clampZoom(0.2, 1, 4, 0.1)).toBe(1);
  });

  it('ajusta ao step', () => {
    expect(clampZoom(1.17, 1, 4, 0.1)).toBeCloseTo(1.2);
    expect(clampZoom(2.04, 1, 4, 0.1)).toBeCloseTo(2.0);
  });

  it('retorna min quando min === max', () => {
    expect(clampZoom(5, 1, 1, 0.1)).toBe(1);
  });
});

describe('calculateSharpness & isFrameSharp', () => {
  function makeMockImageData(width: number, height: number, pattern: 'flat' | 'checkerboard' | 'gradient'): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        let val = 128;
        if (pattern === 'flat') {
          val = 128;
        } else if (pattern === 'checkerboard') {
          val = (x + y) % 2 === 0 ? 0 : 255;
        } else if (pattern === 'gradient') {
          val = Math.round((x / width) * 255);
        }
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
      }
    }
    return { data, width, height, colorSpace: 'srgb' } as ImageData;
  }

  it('retorna 0 para imagem plana (sem contornos)', () => {
    const flat = makeMockImageData(20, 20, 'flat');
    expect(calculateSharpness(flat)).toBe(0);
    expect(isFrameSharp(flat)).toBe(false);
  });

  it('retorna nitidez alta para imagem nítida com alto contraste', () => {
    const checker = makeMockImageData(20, 20, 'checkerboard');
    const score = calculateSharpness(checker);
    expect(score).toBeGreaterThan(100);
    expect(isFrameSharp(checker, 75)).toBe(true);
  });

  it('retorna 0 para dimensões inválidas ou menores que 3x3', () => {
    const tiny = { data: new Uint8ClampedArray(8), width: 2, height: 1, colorSpace: 'srgb' } as ImageData;
    expect(calculateSharpness(tiny)).toBe(0);
  });
});

describe('setFocusPoint & triggerAutoFocus', () => {
  it('aplica constraints de foco no track e retorna true', async () => {
    const applyConstraintsMock = vi.fn().mockResolvedValue(undefined);
    const mockCamera = {
      stream: {} as MediaStream,
      track: { applyConstraints: applyConstraintsMock } as unknown as MediaStreamTrack,
      caps: {
        torchSupported: false,
        zoomSupported: false,
        zoomMin: 1,
        zoomMax: 1,
        zoomStep: 0.1,
        focusModeSupported: true,
        focusModes: ['continuous', 'single-shot'],
        pointsOfInterestSupported: true,
      },
    } as ActiveCamera;

    const res = await setFocusPoint(mockCamera, { x: 0.3, y: 0.7 });
    expect(res).toBe(true);
    expect(applyConstraintsMock).toHaveBeenCalled();
  });

  it('retorna false graciosamente se track for nulo', async () => {
    const mockCamera = {
      stream: {} as MediaStream,
      track: null,
      caps: {
        torchSupported: false,
        zoomSupported: false,
        zoomMin: 1,
        zoomMax: 1,
        zoomStep: 0.1,
        focusModeSupported: false,
        focusModes: [],
        pointsOfInterestSupported: false,
      },
    } as ActiveCamera;

    const res = await setFocusPoint(mockCamera, { x: 0.5, y: 0.5 });
    expect(res).toBe(false);
  });

  it('triggerAutoFocus centraliza em (0.5, 0.5)', async () => {
    const applyConstraintsMock = vi.fn().mockResolvedValue(undefined);
    const mockCamera = {
      stream: {} as MediaStream,
      track: { applyConstraints: applyConstraintsMock } as unknown as MediaStreamTrack,
      caps: {
        torchSupported: false,
        zoomSupported: false,
        zoomMin: 1,
        zoomMax: 1,
        zoomStep: 0.1,
        focusModeSupported: true,
        focusModes: ['continuous'],
        pointsOfInterestSupported: true,
      },
    } as ActiveCamera;

    const res = await triggerAutoFocus(mockCamera);
    expect(res).toBe(true);
    expect(applyConstraintsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        advanced: expect.arrayContaining([
          expect.objectContaining({
            pointsOfInterest: [{ x: 0.5, y: 0.5 }],
          }),
        ]),
      }),
    );
  });
});


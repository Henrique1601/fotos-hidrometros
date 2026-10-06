/**
 * Utilitários de edição e rotação de fotos de hidrômetros.
 */

export type RotationAngle = 90 | 180 | 270 | -90;

/**
 * Normaliza qualquer ângulo (positivo ou negativo) para um dos 4 ângulos válidos [0, 90, 180, 270].
 */
export function normalizeRotationAngle(degrees: number): number {
  return ((Math.round(degrees) % 360) + 360) % 360;
}

/**
 * Rotaciona um Blob de imagem no ângulo especificado (sentido horário em graus).
 * Utiliza createImageBitmap quando disponível (alta velocidade, sem DOM)
 * e possui fallback para HTMLImageElement.
 */
export async function rotateImageBlob(blob: Blob, degrees: number = 90): Promise<Blob> {
  const normalized = normalizeRotationAngle(degrees);
  if (normalized === 0) return blob;

  // 1. Tentar createImageBitmap (rápido em mobile e browsers modernos)
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      try {
        if (typeof document === 'undefined') return blob;
        const isPerpendicular = normalized === 90 || normalized === 270;
        const targetW = isPerpendicular ? bitmap.height : bitmap.width;
        const targetH = isPerpendicular ? bitmap.width : bitmap.height;

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Contexto 2D indisponível');

        ctx.translate(targetW / 2, targetH / 2);
        ctx.rotate((normalized * Math.PI) / 180);
        ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

        return await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => {
              canvas.width = 0;
              canvas.height = 0;
              if (b) resolve(b);
              else reject(new Error('Falha ao gerar blob rotacionado'));
            },
            blob.type || 'image/jpeg',
            0.88,
          );
        });
      } finally {
        bitmap.close();
      }
    } catch {
      // Fallback para HTMLImageElement
    }
  }

  // 2. Fallback via URL.createObjectURL e HTMLImageElement
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Erro ao carregar imagem para rotação'));
        i.src = url;
      });

      const isPerpendicular = normalized === 90 || normalized === 270;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      const canvas = document.createElement('canvas');
      canvas.width = isPerpendicular ? h : w;
      canvas.height = isPerpendicular ? w : h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Contexto 2D indisponível');

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((normalized * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2);

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            canvas.width = 0;
            canvas.height = 0;
            if (b) resolve(b);
            else reject(new Error('Falha ao exportar blob rotacionado'));
          },
          blob.type || 'image/jpeg',
          0.88,
        );
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return blob;
}

/**
 * Espelha/inverte um Blob de imagem horizontalmente ou verticalmente.
 */
export async function flipImageBlob(blob: Blob, horizontal = true): Promise<Blob> {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return blob;
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Erro ao carregar imagem para inversão'));
      i.src = url;
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Contexto 2D indisponível');

    ctx.translate(horizontal ? w : 0, horizontal ? 0 : h);
    ctx.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
    ctx.drawImage(img, 0, 0, w, h);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          canvas.width = 0;
          canvas.height = 0;
          if (b) resolve(b);
          else reject(new Error('Falha ao exportar blob invertido'));
        },
        blob.type || 'image/jpeg',
        0.88,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

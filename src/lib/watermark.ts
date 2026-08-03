export async function watermarkPhoto(blob: Blob, text: string, maxW = 1280): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Erro na imagem'));
    i.src = url;
  });

  const scale = Math.min(1, maxW / img.width);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Sem canvas');
  ctx.drawImage(img, 0, 0, w, h);

  const barH = Math.max(18, Math.round(h * 0.09));
  ctx.fillStyle = 'rgba(7, 24, 34, 0.72)';
  ctx.fillRect(0, h - barH, w, barH);
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${Math.max(13, Math.round(w * 0.03))}px "JetBrains Mono", monospace`;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, Math.round(w * 0.025), h - barH / 2);

  URL.revokeObjectURL(url);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao gerar marca d\u2019água'))),
      'image/jpeg',
      0.85,
    );
  });
}

export function formatWatermarkDate(ts: number | null | undefined): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

import { formatIndex } from './utils';

export interface VoucherData {
  condoName?: string;
  towerId: string;
  aptCode: string;
  campaignLabel: string;
  dateStr?: string;
  previousIndex: number | null | undefined;
  currentIndex: number | null | undefined;
  photo?: Blob | null;
}

export function buildVoucherText(data: VoucherData): string {
  const prevStr =
    data.previousIndex !== null && data.previousIndex !== undefined
      ? `${formatIndex(data.previousIndex)} m³`
      : 'Sem base';
  const currStr =
    data.currentIndex !== null && data.currentIndex !== undefined
      ? `${formatIndex(data.currentIndex)} m³`
      : 'Não informado';

  let consumptionStr = '—';
  if (
    data.currentIndex !== null &&
    data.currentIndex !== undefined &&
    data.previousIndex !== null &&
    data.previousIndex !== undefined
  ) {
    const cons = data.currentIndex - data.previousIndex;
    consumptionStr = `${formatIndex(cons)} m³`;
  }

  const lines = [
    '💧 *Comprovante de Leitura de Hidrômetro*',
    `🏢 *Torre ${data.towerId} · Apartamento ${data.aptCode}*`,
    `📅 *Referência:* ${data.campaignLabel}`,
  ];

  if (data.dateStr) {
    lines.push(`🕒 *Data da Leitura:* ${data.dateStr}`);
  }

  lines.push('');
  lines.push(`🔹 *Índice Anterior:* ${prevStr}`);
  lines.push(`🔹 *Índice Atual:* ${currStr}`);
  lines.push(`📊 *Consumo do Mês:* ${consumptionStr}`);

  if (
    data.currentIndex !== null &&
    data.currentIndex !== undefined &&
    data.previousIndex !== null &&
    data.previousIndex !== undefined
  ) {
    const cons = data.currentIndex - data.previousIndex;
    if (cons > 30) {
      lines.push('⚠️ *Atenção:* Consumo elevado detectado neste mês.');
    } else if (cons < 0) {
      lines.push('⚠️ *Atenção:* Índice menor que o anterior (verificar hidrômetro).');
    }
  }

  return lines.join('\n');
}

export async function shareVoucher(
  data: VoucherData,
): Promise<{ shared: boolean; via: 'native' | 'whatsapp' | 'clipboard' }> {
  const text = buildVoucherText(data);
  const title = `Medição Torre ${data.towerId} Apt ${data.aptCode} - ${data.campaignLabel}`;

  if (data.photo && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const ext = data.photo.type?.includes('png') ? 'png' : 'jpg';
      const file = new File(
        [data.photo],
        `hidrometro-torre${data.towerId}-apt${data.aptCode}.${ext}`,
        { type: data.photo.type || 'image/jpeg' },
      );
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          text,
          files: [file],
        });
        return { shared: true, via: 'native' };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { shared: false, via: 'native' };
      }
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text });
      return { shared: true, via: 'native' };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { shared: false, via: 'native' };
      }
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignora erro de clipboard se bloqueado
    }
  }

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank');
  }

  return { shared: true, via: 'whatsapp' };
}

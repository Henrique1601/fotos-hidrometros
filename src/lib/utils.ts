export const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function monthName(m: number): string {
  return MONTHS[m - 1] ?? '';
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function campaignLabel(name: string | undefined, month: number, year: number): string {
  return name && name.trim() ? name.trim() : `${monthName(month)} ${year}`;
}

export function formatIndex(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(n);
}

export function parseIndex(text: string): number | null {
  if (!text) return null;
  let t = text.trim().replace(/\s+/g, '');
  if (!t) return null;

  if (t.includes(',') && t.includes('.')) {
    const lastComma = t.lastIndexOf(',');
    const lastDot = t.lastIndexOf('.');
    if (lastComma > lastDot) {
      t = t.replace(/\./g, '').replace(',', '.');
    } else {
      t = t.replace(/,/g, '');
    }
  } else if (t.includes(',')) {
    t = t.replace(',', '.');
  } else if (t.includes('.')) {
    // Se tiver formato exato de milhar brasileiro puro (ex.: 1.234 ou 10.500)
    if (/^\d{1,3}\.\d{3}$/.test(t)) {
      t = t.replace(/\./g, '');
    }
    // Caso contrário (ex.: 2624.51 do teclado do PC ou 12.5), mantém o ponto como decimal
  }

  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function sideLabel(side: 'left' | 'right'): string {
  return side === 'left' ? 'Esquerda' : 'Direita';
}

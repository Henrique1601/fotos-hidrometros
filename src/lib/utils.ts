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
  const t = text.trim().replace(/\./g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function sideLabel(side: 'left' | 'right'): string {
  return side === 'left' ? 'Esquerda' : 'Direita';
}

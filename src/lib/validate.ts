export type WarningCode = 'dropped' | 'outlier' | 'jump' | 'excessive_consumption' | 'unrealistic_value';

export interface IndexWarning {
  code: WarningCode;
  message: string;
}

export interface ValidateOptions {
  maxDiff?: number;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((acc, v) => acc + (v - m) * (v - m), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function validateIndex(
  next: number,
  prev: number | null | undefined,
  peers: number[],
  options?: ValidateOptions,
): IndexWarning[] {
  const warnings: IndexWarning[] = [];

  if (prev !== null && prev !== undefined && next < prev) {
    warnings.push({
      code: 'dropped',
      message: `O índice caiu de ${formatNum(prev)} para ${formatNum(next)}. Confira a leitura.`,
    });
  }

  const cleanPeers = peers.filter((p) => p !== null && p !== undefined && p > 0);
  if (cleanPeers.length >= 3) {
    const m = mean(cleanPeers);
    const s = stddev(cleanPeers);
    if (s > 0 && Math.abs(next - m) > 3 * s) {
      warnings.push({
        code: 'outlier',
        message: `Valor muito fora da média da torre (${formatNum(m)}). Confira a leitura.`,
      });
    }
  }

  if (prev !== null && prev !== undefined && prev > 0 && next > prev * 2) {
    warnings.push({
      code: 'jump',
      message: `Aumento acima de 100% vs. o registro anterior (${formatNum(prev)}). Confira.`,
    });
  }

  if (options?.maxDiff && prev !== null && prev !== undefined && next - prev > options.maxDiff) {
    warnings.push({
      code: 'excessive_consumption',
      message: `Consumo de ${formatNum(next - prev)} m³ não condiz com o habitual de um apartamento (acima do limite de ${options.maxDiff} m³). Verifique se o índice está correto.`,
    });
  }

  if (next >= 50000) {
    warnings.push({
      code: 'unrealistic_value',
      message: `Índice muito alto (${formatNum(next)}). Verifique se os números vermelhos (litros) não foram digitados junto com os pretos.`,
    });
  }

  return warnings;
}

function formatNum(v: number): string {
  return v.toLocaleString('pt-BR');
}

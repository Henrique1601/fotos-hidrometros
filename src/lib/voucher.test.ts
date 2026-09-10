import { describe, expect, it } from 'vitest';
import { buildVoucherText } from './voucher';

describe('voucher utility', () => {
  it('formats voucher with previous index, current index and consumption', () => {
    const text = buildVoucherText({
      towerId: 'A',
      aptCode: '42',
      campaignLabel: 'Agosto 2026',
      dateStr: '10/08/2026 14:30',
      previousIndex: 906.19,
      currentIndex: 918.45,
    });

    expect(text).toContain('Torre A · Apartamento 42');
    expect(text).toContain('Referência:* Agosto 2026');
    expect(text).toContain('Data da Leitura:* 10/08/2026 14:30');
    expect(text).toContain('Índice Anterior:* 906,19 m³');
    expect(text).toContain('Índice Atual:* 918,45 m³');
    expect(text).toContain('Consumo do Mês:* 12,26 m³');
  });

  it('handles base campaign without previous index', () => {
    const text = buildVoucherText({
      towerId: 'B',
      aptCode: '101',
      campaignLabel: 'Julho 2026',
      previousIndex: null,
      currentIndex: 1533.45,
    });

    expect(text).toContain('Índice Anterior:* Sem base');
    expect(text).toContain('Índice Atual:* 1.533,45 m³');
    expect(text).toContain('Consumo do Mês:* —');
  });

  it('adds warning alert when consumption exceeds 30 m3', () => {
    const text = buildVoucherText({
      towerId: 'C',
      aptCode: '92',
      campaignLabel: 'Agosto 2026',
      previousIndex: 100,
      currentIndex: 145,
    });

    expect(text).toContain('Consumo elevado detectado neste mês');
  });

  it('adds warning alert when index regresses', () => {
    const text = buildVoucherText({
      towerId: 'D',
      aptCode: '232',
      campaignLabel: 'Agosto 2026',
      previousIndex: 200,
      currentIndex: 195,
    });

    expect(text).toContain('Índice menor que o anterior');
  });
});

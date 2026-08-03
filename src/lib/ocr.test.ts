import { describe, it, expect } from 'vitest';
import { parseOcrNumber } from './ocr';

describe('parseOcrNumber', () => {
  it('extrai número simples', () => {
    expect(parseOcrNumber('12345')).toBe(12345);
  });

  it('extrai número com vírgula', () => {
    expect(parseOcrNumber('1234,5')).toBe(1234.5);
  });

  it('extrai número com ponto decimal', () => {
    expect(parseOcrNumber('1234.5')).toBe(1234.5);
  });

  it('corrige O para 0', () => {
    expect(parseOcrNumber('12O4')).toBe(1204);
  });

  it('corrige l para 1', () => {
    expect(parseOcrNumber('1l23')).toBe(1123);
  });

  it('corrige S para 5', () => {
    expect(parseOcrNumber('12S4')).toBe(1254);
  });

  it('corrige B para 8', () => {
    expect(parseOcrNumber('12B4')).toBe(1284);
  });

  it('extrai o maior número do texto', () => {
    expect(parseOcrNumber('Torre A 12345 andar')).toBe(12345);
  });

  it('retorna null para texto sem números', () => {
    expect(parseOcrNumber('abc')).toBeNull();
  });

  it('retorna null para valor negativo', () => {
    expect(parseOcrNumber('-5')).toBeNull();
  });

  it('retorna null para valor > 9999999', () => {
    expect(parseOcrNumber('10000000')).toBeNull();
  });

  it('aceita valor zero', () => {
    expect(parseOcrNumber('0')).toBe(0);
  });

  it('aceita valor com ponto e vírgula misturados', () => {
    expect(parseOcrNumber('1.234,5')).toBe(1234.5);
  });

  it('remove caracteres não numéricos', () => {
    expect(parseOcrNumber('abc1234def')).toBe(1234);
  });

  it('trata múltiplos pontos decimais', () => {
    expect(parseOcrNumber('1.234.567')).toBe(1234567);
  });
});

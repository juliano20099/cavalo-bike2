import { describe, it, expect } from 'vitest';
import { reaisParaCentavos, centavosParaCampo, formatarData, formatarTelefone, linkWhatsApp, brl } from './utils.js';

describe('reaisParaCentavos', () => {
  it('aceita formato brasileiro', () => {
    expect(reaisParaCentavos('12,50')).toBe(1250);
    expect(reaisParaCentavos('1.234,56')).toBe(123456);
    expect(reaisParaCentavos('R$ 10')).toBe(1000);
  });
  it('aceita ponto decimal e milhar sem vírgula', () => {
    expect(reaisParaCentavos('12.5')).toBe(1250);
    expect(reaisParaCentavos('1.234')).toBe(123400);
  });
  it('rejeita valores inválidos', () => {
    expect(reaisParaCentavos('')).toBeNaN();
    expect(reaisParaCentavos('abc')).toBeNaN();
    expect(reaisParaCentavos('1,234')).toBeNaN();
    expect(reaisParaCentavos('-5')).toBeNaN();
  });
});

describe('formatação', () => {
  it('converte centavos para campo e moeda', () => {
    expect(centavosParaCampo(1250)).toBe('12,50');
    expect(brl(1250)).toContain('12,50');
  });
  it('formata data e telefone', () => {
    expect(formatarData('2026-10-25')).toBe('25/10/2026');
    expect(formatarData(null)).toBe('—');
    expect(formatarTelefone('81999990000')).toBe('(81) 99999-0000');
  });
  it('gera link do WhatsApp', () => {
    expect(linkWhatsApp('(81) 99999-0000')).toBe('https://wa.me/5581999990000');
  });
});

import { describe, expect, it } from 'vitest';
import { COMPRIMENTOS, calcularBitola, validarBitolas } from './madeira-serrada';
describe('pacotes multi-bitola', () => {
  it('oferece 17 comprimentos de 1 a 9 em passos de 0,5', () => {
    expect(COMPRIMENTOS).toEqual(['1.0','1.5','2.0','2.5','3.0','3.5','4.0','4.5','5.0','5.5','6.0','6.5','7.0','7.5','8.0','8.5','9.0']);
  });
  it('aplica centímetros / 10.000 em todas as peças', () => {
    expect(calcularBitola({ especie: 'Cupiúba', tipo_peca: 'Viga', grossura: 5, largura: 15, distribuicao_pecas: { '1.5': 2, '6.0': 10 } })).toEqual({ pecas: 12, volume: 0.4725 });
  });
  it('soma diferentes bitolas sem perder medidas', () => {
    const a = calcularBitola({ especie:'Cupiúba', tipo_peca:'Viga', grossura:5, largura:15, distribuicao_pecas:{'6.0':10} });
    const b = calcularBitola({ especie:'Cupiúba', tipo_peca:'Caibro', grossura:5, largura:7, distribuicao_pecas:{'3.0':20} });
    expect(a.volume + b.volume).toBeCloseTo(0.66, 4); expect(a.pecas + b.pecas).toBe(30);
  });
  it('rejeita peças negativas, fracionadas, bitola zero e comprimento fora da grade', () => {
    const item = { especie:'Cupiúba', tipo_peca:'Viga', grossura:5, largura:15, distribuicao_pecas:{'1.0':1} };
    for (const bad of [{...item,grossura:0},{...item,distribuicao_pecas:{'1.0':-1}},{...item,distribuicao_pecas:{'1.0':1.5}},{...item,distribuicao_pecas:{'9.5':1}}]) expect(() => validarBitolas([bad])).toThrow();
  });
});
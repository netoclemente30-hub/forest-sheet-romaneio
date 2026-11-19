import { describe, expect, it } from 'vitest';
import { cargaManual, itemDoCadastro } from './fiscal-manual';
import { montarRascunho, detalhesIniciais } from './fiscal';

describe('NF-e sem romaneio', () => {
  it('começa sem itens e sem dados de outra nota', () => {
    expect(cargaManual('2026-11-19')).toEqual({ numero: '', data: '2026-11-19', itens: [] });
  });
  it('aplica o item cadastrado e mantém a quantidade específica da nova nota', () => {
    expect(itemDoCadastro({ codigo: 'MAD', descricao: 'Madeira', ncm: '44072990', cfop: '5102', preco: '100', unidade: 'M3' })).toEqual({ codigo: 'MAD', descricao: 'Madeira', ncm: '44072990', unidade: 'M3', quantidade: 0 });
  });
  it('gera a nota manual com quantidade, valor e emitente salvo', () => {
    const carga = { ...cargaManual('2026-11-19'), itens: [{ ...itemDoCadastro(), codigo: 'MAD', descricao: 'Madeira', quantidade: 2.5 }] };
    const emitente = { nome: 'Empresa Teste', cnpj: '50165504000130', ie: '6622801' };
    const nota = montarRascunho(emitente, carga, 'manual:1', { ...detalhesIniciais(carga), nome: 'Cliente' }, ['100']);
    expect(nota.total).toBe(25000);
    expect(nota.cadastro).toEqual(emitente);
    expect(nota.itens[0]?.quantidade).toBe(2.5);
  });
});
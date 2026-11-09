import { describe, expect, it } from 'vitest';
import { compararVolumes, listarTorasEncaixadas, type RegistroEncaixe } from './toras-encaixadas';
import type { Tora } from './data';
import type { ItemFila } from './offline/fila';

const tora: Tora = { empresa_id: 'RJ', plaqueta: 251, arvore: 2253, secao: 'B', autex: 'AUTEX-2013.2.2025.41234', especie: 'Mandioqueiro', nome_cientifico: 'Qualea paraensis', volume: 1.7797, d_topo1: 54, d_topo2: 50, d_pe1: 50, d_pe2: 55, comprimento: 8.3, created_at: '2026-11-09T19:57:25.417Z', origem: 'serraria', carregada: false, serrada_em: null, romaneio_id: null, etiqueta_impressa_em: null };
const registro: RegistroEncaixe = { id: 'r1', empresa_id: 'RJ', acao: 'Encaixe confirmado', detalhe: 'Plaqueta 251 · saldo 1.8834 m³ · medido 1.7797 m³', criado_em: tora.created_at, revertido_em: null, mudancas: [{ tabela: 'toras', antes: null, depois: { ...tora } }] };
const item: ItemFila = { id: 'fila1', criadoEm: 1, op: { tipo: 'tora_insert', dados: { ...tora }, log: { acao: registro.acao, detalhe: registro.detalhe ?? '', criado_em: registro.criado_em, user_email: null, lat: null, lng: null } } };

describe('toras encaixadas na Serraria', () => {
  it('compara saldo menos medido em m³ e percentual sobre o saldo', () => {
    expect(compararVolumes(2, 1.8).diferenca).toBeCloseTo(0.2);
    expect(compararVolumes(2, 1.8).percentual).toBeCloseTo(10);
    expect(compararVolumes(2, 2.2).percentual).toBeCloseTo(-10);
  });
  it('não inventa percentual quando o saldo é zero ou desconhecido', () => {
    expect(compararVolumes(0, 1).percentual).toBeNull();
    expect(compararVolumes(null, 1)).toEqual({ diferenca: null, percentual: null });
  });
  it('preserva volumes e medidas do encaixe real mesmo depois de editar a tora', () => {
    const [r] = listarTorasEncaixadas([registro], [{ ...tora, volume: 3, d_topo1: 90 }], [], 'RJ');
    expect(r?.saldo).toBe(1.8834);
    expect(r?.medido).toBe(1.7797);
    expect(r?.diferenca).toBeCloseTo(0.1037);
    expect(r?.percentual).toBeCloseTo(5.5059997876);
    expect(r?.tora).toMatchObject({ plaqueta: 251, arvore: 2253, secao: 'B', autex: 'AUTEX-2013.2.2025.41234', especie: 'Mandioqueiro', d_topo1: 54, d_topo2: 50, d_pe1: 50, d_pe2: 55, comprimento: 8.3 });
  });
  it('exclui outras empresas, medições sem encaixe e encaixes revertidos', () => {
    expect(listarTorasEncaixadas([{ ...registro, empresa_id: 'OUTRA' }, { ...registro, acao: 'Tora lançada' }, { ...registro, revertido_em: '2026-11-10T00:00:00Z' }], [tora], [], 'RJ')).toEqual([]);
    expect(listarTorasEncaixadas([registro], [tora], [], null)).toEqual([]);
  });
  it('inclui pendências offline com erro e não duplica o encaixe já enviado', () => {
    expect(listarTorasEncaixadas([], [tora], [{ ...item, erro: 'Falha' }], 'RJ')[0]?.estado).toBe('Pendente com erro');
    expect(listarTorasEncaixadas([registro], [tora], [item], 'RJ')).toHaveLength(1);
  });
  it('mantém histórico excluído sem associar a uma plaqueta reutilizada', () => {
    const [r] = listarTorasEncaixadas([registro], [{ ...tora, created_at: '2026-11-10T00:00:00Z', arvore: 999 }], [], 'RJ');
    expect(r?.estado).toBe('Fora do estoque');
    expect(r?.tora.arvore).toBe(2253);
  });
  it('recupera registro antigo apenas se a data de criação da tora corresponder', () => {
    expect(listarTorasEncaixadas([{ ...registro, mudancas: null }], [tora], [], 'RJ')).toHaveLength(1);
    expect(listarTorasEncaixadas([{ ...registro, mudancas: null }], [{ ...tora, created_at: '2026-11-10T00:00:00Z' }], [], 'RJ')).toHaveLength(0);
  });
});
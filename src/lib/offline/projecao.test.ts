import { describe, expect, it } from 'vitest';
import { projetarDados } from './projecao';
import type { ItemFila } from './fila';

const insert: ItemFila = { id: 'a', criadoEm: 1, op: { tipo: 'tora_insert', dados: { empresa_id: 'RJ', plaqueta: 9, volume: 2 } } };
describe('projeção cache e fila', () => {
  it('plaqueta igual em outra empresa não recebe alteração ou volume', () => {
    const base = [{ empresa_id: 'Outra', plaqueta: 9, volume: 99 }];
    expect(projetarDados('toras', base, [insert], 'Outra')).toEqual(base);
    expect(projetarDados('toras', base, [insert], 'RJ')).toEqual([expect.objectContaining({ empresa_id: 'RJ', plaqueta: 9, volume: 2 })]);
  });
  it('resposta perdida não duplica tora e total', () => {
    const rows = projetarDados('toras', [{ empresa_id: 'RJ', plaqueta: 9, volume: 2 }], [insert], 'RJ');
    expect(rows).toHaveLength(1);
    expect(rows.reduce((n, row) => n + row.volume, 0)).toBe(2);
  });
  it('edições sequenciais projetam o último valor sem alterar o cache original', () => {
    const base = [{ empresa_id: 'RJ', plaqueta: 9, volume: 2 }];
    const items: ItemFila[] = [3, 4].map((volume, i) => ({ id: String(i), criadoEm: i, op: { tipo: 'tora_update', empresa_id: 'RJ', plaqueta: 9, autex: null, dados: { volume } } }));
    expect(projetarDados('toras', base, items, 'RJ')[0]?.volume).toBe(4);
    expect(base[0]?.volume).toBe(2);
  });
  it('conflito continua identificado e visível sem adicionar segunda tora', () => {
    const rows = projetarDados('toras', [], [{ ...insert, erro: 'Plaqueta duplicada' }], 'RJ');
    expect(rows).toEqual([expect.objectContaining({ plaqueta: 9, conflito_local: 'Plaqueta duplicada' })]);
  });
  it('carga já confirmada é encontrada por operação mesmo com ID remoto diferente', () => {
    const item: ItemFila = { id: 'op', criadoEm: 1, op: { tipo: 'romaneio_salvar', empresa_id: 'RJ', cab: { placa: 'ABC', motorista: 'M', julieta: '', cpf: '', data: '2026-11-19' }, total_volume: 2, qtd_toras: 1, plaquetas: [9] } };
    expect(projetarDados('romaneios', [{ id: 'id-remoto', empresa_id: 'RJ', operacao_id: 'op' }], [item], 'RJ')).toHaveLength(1);
  });
  it('NI pendente aparece com edição e exclusão sem duplicar', () => {
    const log = { acao: 'fixture', detalhe: '', user_email: null, lat: null, lng: null, criado_em: '2026-11-19' };
    const items: ItemFila[] = [
      { id: 'ni-insert', criadoEm: 1, op: { tipo: 'aguardando_insert', dados: { id: 'ni', empresa_id: 'RJ', numero: 1, volume: 2 }, log } },
      { id: 'ni-update', criadoEm: 2, op: { tipo: 'aguardando_update', id: 'ni', empresa_id: 'RJ', dados: { volume: 4 }, log } },
    ];
    expect(projetarDados('toras_aguardando', [], items, 'RJ')).toEqual([expect.objectContaining({ id: 'ni', volume: 4 })]);
    items.push({ id: 'ni-delete', criadoEm: 3, op: { tipo: 'aguardando_delete', id: 'ni', empresa_id: 'RJ', log } });
    expect(projetarDados('toras_aguardando', [], items, 'RJ')).toEqual([]);
  });
});
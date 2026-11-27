import { describe, expect, it } from 'vitest';
import { projetarDados } from './projecao';
import type { ItemFila } from './fila';

const insert: ItemFila = { id: 'a', criadoEm: 1, op: { tipo: 'tora_insert', dados: { empresa_id: 'RJ', plaqueta: 9, volume: 2 } } };
describe('projeção cache e fila', () => {
  it('resposta perdida de carga conserva o ID remoto já confirmado das toras', () => {
    const item:ItemFila = {id:'op',criadoEm:1,envio_iniciado:true,op:{tipo:'romaneio_salvar',empresa_id:'RJ',cab:{placa:'ABC',motorista:'M',julieta:'',cpf:'',data:'2026-11-24'},plaquetas:[9],total_volume:2,qtd_toras:1}};
    expect(projetarDados('toras',[{empresa_id:'RJ',plaqueta:9,romaneio_id:'remoto',carregada:true}],[item],'RJ')[0]?.romaneio_id).toBe('remoto');
  });
  it('plaqueta igual em outra empresa não recebe alteração ou volume', () => {
    const base = [{ empresa_id: 'Outra', plaqueta: 9, volume: 99 }];
    expect(projetarDados('toras', base, [insert], 'Outra')).toEqual(base);
    expect(projetarDados('toras', base, [insert], 'RJ')).toEqual([expect.objectContaining({ empresa_id: 'RJ', plaqueta: 9, volume: 2 })]);
  });
  it('mostra etiqueta emitida offline sem modificar o estoque de outra empresa', () => {
    const em = '2026-11-19T10:00:00.000Z';
    const item: ItemFila = { id: 'etiqueta', criadoEm: 1, op: { tipo: 'toras_etiquetas', empresa_id: 'RJ', plaquetas: [9],
      log: { acao: 'Etiqueta emitida', detalhe: '9', user_email: null, lat: null, lng: null, criado_em: em } } };
    const base = [{ empresa_id: 'RJ', plaqueta: 9, etiqueta_impressa_em: null }, { empresa_id: 'Outra', plaqueta: 9, etiqueta_impressa_em: null }];
    expect(projetarDados('toras', base, [item], 'RJ')[0]?.etiqueta_impressa_em).toBe(em);
    expect(projetarDados('toras', base, [item], 'Outra')[0]?.etiqueta_impressa_em).toBeNull();
    expect(projetarDados('toras', base, [{ ...item, erro: 'permissão' }], 'RJ')[0]?.etiqueta_impressa_em).toBeNull();
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
  it('edição de romaneio troca as plaquetas e mantém outra empresa intacta', () => {
    const log = { acao: 'Romaneio editado', detalhe: '', user_email: null, lat: null, lng: null, criado_em: '2026-11-27', operacao_id: 'edicao' };
    const item: ItemFila = { id: 'edicao', criadoEm: 2, op: { tipo: 'romaneio_editar', id: 'carga', empresa_id: 'RJ', cab: { placa: 'NOVA1', motorista: 'M', julieta: '', cpf: '', data: '2026-11-27' }, total_volume: 4, qtd_toras: 1, plaquetas: [20], log } };
    const base = [
      { empresa_id: 'RJ', plaqueta: 10, volume: 2, carregada: true, romaneio_id: 'carga' },
      { empresa_id: 'RJ', plaqueta: 20, volume: 4, carregada: false, romaneio_id: null },
      { empresa_id: 'OUTRA', plaqueta: 20, volume: 9, carregada: false, romaneio_id: null },
    ];
    expect(projetarDados('toras', base, [item], 'RJ')).toEqual([
      expect.objectContaining({ plaqueta: 10, carregada: false, romaneio_id: null }),
      expect.objectContaining({ plaqueta: 20, carregada: true, romaneio_id: 'carga' }),
    ]);
    expect(projetarDados('toras', base, [item], 'OUTRA')).toEqual([base[2]]);
    expect(projetarDados('romaneios', [{ id: 'carga', empresa_id: 'RJ', placa: 'ANTIGA', qtd_toras: 1, total_volume: 2 }], [item], 'RJ'))
      .toEqual([expect.objectContaining({ placa: 'NOVA1', qtd_toras: 1, total_volume: 4 })]);
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

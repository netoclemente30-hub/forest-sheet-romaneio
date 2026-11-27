import type { ItemFila } from './fila';

/** Pure projection: persisted base remains authoritative; pending/conflicts are annotated. */
export function projetarDados<T>(nome: string, base: T[], itens: ItemFila[], empresa: string | null): T[] {
  if (!empresa) return base;
  const rows = base.filter(row => !(row && typeof row === 'object' && 'empresa_id' in row) || (row as Record<string, unknown>)['empresa_id'] === empresa).map(row => ({ ...row }) as Record<string, unknown>);
  const alvo = (row: Record<string, unknown>, id: unknown) => nome === 'toras' ? row['plaqueta'] === id : row['id'] === id;
  for (const item of itens) {
    const op = item.op;
    const emp = 'empresa_id' in op ? op.empresa_id : 'dados' in op ? op.dados['empresa_id'] : null;
    if (emp !== empresa) continue;
    const tipo = op.tipo === 'estoque_operacao' ? op.tipo_operacao : op.tipo;
    const dados = 'dados' in op ? op.dados as Record<string, unknown> : {};
    const ids = op.tipo === 'estoque_operacao' ? op.alvos : 'plaquetas' in op ? op.plaquetas : 'plaqueta' in op ? [op.plaqueta] : 'id' in op ? [op.id] : [];
    const status = { pendente_local: true, conflito_local: item.erro ?? null, fila_id: item.id };
    const em = op.log?.criado_em ?? new Date(item.criadoEm).toISOString();
    if (op.tipo === 'romaneio_importado_salvar' && nome === `romaneios-serrados-importados:${empresa}`) {
      const total_pecas = op.itens.reduce((n, p) => n + p.quantidade, 0);
      const total_volume_m3 = op.itens.reduce((n, p) => n + p.grossura * p.largura * p.comprimento * p.quantidade / 10000, 0);
      const row = { id: op.documento_id, empresa_id: empresa, cab: op.cab, itens: op.itens, revisao: op.revisao, total_pecas, total_volume_m3, ...status };
      const index = rows.findIndex(r => r['id'] === op.documento_id);
      if (index < 0) rows.push(row); else rows[index] = row;
    }
    if (op.tipo === 'campo_update' && nome === op.tabela && !(item.erro && op.limitesAnteriores !== undefined)) {
      const index = rows.findIndex(r => r[op.chave] === op.alvo);
      if (index >= 0) rows[index] = { ...rows[index], ...op.dados, ...status };
    }
    if (nome.startsWith('saldo-linhas:') && op.tipo === 'cadastro_upsert' && op.tabela === 'saldos' && Array.isArray(op.dados['linhas'])) {
      rows.splice(0, rows.length, ...op.dados['linhas'].map(row => ({ ...row, ...status })));
    }
    if (op.tipo === 'cadastro_upsert' && (nome === op.tabela || nome.startsWith(`${op.tabela}:`))) {
      if (op.tabela === 'explanadas' && nome !== 'explanadas:' && nome !== `explanadas:${op.dados['autex']}`) continue;
      const dadosCadastro: Record<string, unknown> = { ...op.dados, empresa_id: empresa, ...status };
      const key = op.tabela === 'autex' ? 'numero' : 'id';
      const index = rows.findIndex(r => r[key] === dadosCadastro[key]);
      if (index >= 0) rows[index] = { ...rows[index], ...dadosCadastro }; else rows.push(dadosCadastro);
    }
    if (nome === 'toras' && op.tipo === 'arrasto_toras') {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row && row['autex'] === op.autex && op.plaquetas.includes(Number(row['plaqueta']))) rows[i] = { ...row, arrasto_explanada_id: op.explanada_id, arrastada_em: op.capturado_em, arrasto_lat: op.latitude, arrasto_lng: op.longitude, ...status };
      }
    }
    if (nome === 'toras' && op.tipo === 'transferencia_explanada') {
      const index = rows.findIndex(r => r['plaqueta'] === op.plaqueta && r['autex'] === op.autex);
      if (index >= 0) rows[index] = { ...rows[index], arrasto_explanada_id: op.destino_id, ...status };
    }
    if (nome.startsWith('rastros:') && op.tipo === 'rastro_salvar' && nome === `rastros:${op.autex}`) {
      for (const ponto of op.pontos) if (!rows.some(r => r['id'] === ponto.id)) rows.push({ ...ponto, created_at: em, ...status });
    }
    if ((nome === 'toras' && tipo === 'tora_insert') || (nome === 'toras_aguardando' && tipo === 'aguardando_insert')) {
      const id = nome === 'toras' ? dados['plaqueta'] : dados['id'];
      const index = rows.findIndex(r => alvo(r, id));
      if (index < 0) rows.push({ created_at: em, carregada: false, romaneio_id: null, serrada_em: null, etiqueta_impressa_em: null, ...dados, ...status });
      else rows[index] = { ...rows[index], ...status };
    }
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      if (!row || !ids.some(id => alvo(row, id))) continue;
      if ((nome === 'toras' && ['tora_delete', 'toras_delete'].includes(tipo)) || (nome === 'toras_aguardando' && tipo === 'aguardando_delete')) {
        if (!item.erro) rows.splice(i, 1); else rows[i] = { ...row, ...status };
      } else if ((nome === 'toras' && tipo === 'tora_update') || (nome === 'toras_aguardando' && tipo === 'aguardando_update') || (nome === 'arvores' && tipo === 'arvore_gps')) {
        rows[i] = { ...row, ...dados, ...status };
      } else if (nome === 'toras' && op.tipo === 'toras_etiquetas' && !item.erro) {
        const anterior = row['etiqueta_impressa_em'];
        if (typeof anterior !== 'string' || Date.parse(anterior) < Date.parse(em)) rows[i] = { ...row, etiqueta_impressa_em: em };
      } else if (nome === 'toras' && tipo === 'toras_serradas') {
        const desfazer = 'desfazer' in op ? op.desfazer : dados['desfazer'];
        rows[i] = { ...row, serrada_em: desfazer ? null : em, ...status };
      } else if (nome === 'romaneios' && tipo === 'romaneio_recebido') {
        rows[i] = { ...row, recebido_em: item.erro ? row['recebido_em'] : em, patio: 'patio' in op ? op.patio : dados['patio'], ...status };
      } else if (nome === 'toras_aguardando' && op.tipo === 'aguardando_impressa') {
        rows[i] = { ...row, etiqueta_impressa: op.imprimiu, etiqueta_impressa_em: op.imprimiu ? em : null, ...status };
      }
    }
    if (nome === 'toras' && op.tipo === 'romaneio_salvar') {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row && op.plaquetas.includes(Number(row['plaqueta']))) rows[i] = { ...row, carregada: !item.erro, romaneio_id: item.erro ? row['romaneio_id'] : row['romaneio_id'] ?? op.log?.operacao_id ?? item.id, ...status };
      }
    }
    if (nome === 'romaneios' && op.tipo === 'romaneio_salvar') {
      const id = op.log?.operacao_id ?? item.id;
      if (!rows.some(r => r['operacao_id'] === id)) rows.push({ id, operacao_id: id, empresa_id: empresa, ...op.cab, total_volume: op.total_volume, qtd_toras: op.qtd_toras, created_at: em, recebido_em: null, patio: null, ...status });
    }
    if (op.tipo === 'romaneio_editar') {
      if (nome === 'romaneios') {
        const index = rows.findIndex(r => r['id'] === op.id);
        if (index >= 0) rows[index] = { ...rows[index], ...op.cab, total_volume: op.total_volume, qtd_toras: op.qtd_toras, ...status };
      }
      if (nome === 'toras') {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const selecionada = op.plaquetas.includes(Number(row['plaqueta']));
          if (selecionada) rows[i] = { ...row, carregada: true, romaneio_id: op.id, ...status };
          else if (row['romaneio_id'] === op.id) rows[i] = { ...row, carregada: false, romaneio_id: null, ...status };
        }
      }
    }
  }
  return rows as T[];
}

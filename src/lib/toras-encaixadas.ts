import type { Tora } from './data';
import type { ItemFila } from './offline/fila';
import type { Json } from '@/integrations/supabase/types';

export type RegistroEncaixe = { id: string; empresa_id: string | null; acao: string; detalhe: string | null; criado_em: string; revertido_em: string | null; mudancas: Json | null };
export type ToraEncaixada = { id: string; tora: Tora; saldo: number | null; medido: number; diferenca: number | null; percentual: number | null; data: string; estado: string };

const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const numero = (v: string | undefined) => {
  if (!v) return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Compare the captured saldo, never a later replacement spreadsheet. */
export function compararVolumes(saldo: number | null, medido: number) {
  const diferenca = saldo !== null && Number.isFinite(saldo) ? saldo - medido : null;
  return { diferenca, percentual: diferenca !== null && saldo !== null && saldo > 0 ? diferenca / saldo * 100 : null };
}

export function listarTorasEncaixadas(registros: RegistroEncaixe[], toras: Tora[], itens: ItemFila[], empresa: string | null): ToraEncaixada[] {
  if (!empresa) return [];
  const atuais = new Map(toras.filter(t => t.empresa_id === empresa).map(t => [t.plaqueta, t]));
  const saida: ToraEncaixada[] = [];
  const adicionar = (id: string, detalhe: string | null, data: string, tora: Tora, estado?: string) => {
    const saldo = numero(detalhe?.match(/\bsaldo\s+([\d.,]+)\s*m³/i)?.[1]);
    const medido = numero(detalhe?.match(/\bmedido\s+([\d.,]+)\s*m³/i)?.[1]) ?? Number(tora.volume);
    const atual = atuais.get(tora.plaqueta);
    const mesma = atual && Date.parse(atual.created_at) === Date.parse(tora.created_at);
    saida.push({ id, tora, saldo, medido, ...compararVolumes(saldo, medido), data, estado: estado ?? (mesma ? atual.serrada_em ? 'Serrada' : 'No estoque' : 'Fora do estoque') });
  };
  for (const r of registros) {
    if (r.empresa_id !== empresa || r.acao !== 'Encaixe confirmado' || r.revertido_em) continue;
    const snapshot = Array.isArray(r.mudancas) ? r.mudancas.find(m => objeto(m) && m.tabela === 'toras' && objeto(m.depois)) : null;
    const d = objeto(snapshot) && objeto(snapshot.depois) ? snapshot.depois : null;
    if (d && d.empresa_id === empresa && typeof d.plaqueta === 'number' && typeof d.arvore === 'number' && typeof d.volume === 'number') {
      adicionar(r.id, r.detalhe, r.criado_em, d as unknown as Tora);
    } else {
      const p = numero(r.detalhe?.match(/^Plaqueta\s+(\d+)/)?.[1]);
      const t = p === null ? undefined : atuais.get(p);
      if (t && Date.parse(t.created_at) === Date.parse(r.criado_em)) adicionar(r.id, r.detalhe, r.criado_em, t);
    }
  }
  for (const i of itens) {
    const op = i.op;
    if (op.tipo !== 'tora_insert' || op.dados.empresa_id !== empresa || op.log?.acao !== 'Encaixe confirmado') continue;
    const d = op.dados;
    if (typeof d.plaqueta !== 'number' || typeof d.arvore !== 'number' || typeof d.volume !== 'number') continue;
    if (saida.some(r => r.tora.plaqueta === d.plaqueta && Date.parse(r.data) === Date.parse(op.log?.criado_em ?? ''))) continue;
    adicionar(i.id, op.log.detalhe, op.log.criado_em, d as unknown as Tora, i.erro ? 'Pendente com erro' : 'Pendente de envio');
  }
  return saida.sort((a, b) => Date.parse(b.data) - Date.parse(a.data) || b.tora.plaqueta - a.tora.plaqueta);
}
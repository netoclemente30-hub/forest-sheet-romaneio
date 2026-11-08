import type { Database, Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { comCache } from './offline/cache';
import { capturarLog } from './registro';

export const COMPRIMENTOS = Array.from({ length: 17 }, (_, i) => (1 + i * 0.5).toFixed(1));
export type BitolaSerrada = { especie: string; tipo_peca: string; grossura: number; largura: number; distribuicao_pecas: Record<string, number> };
type Tables = Database['public']['Tables'];
export type ItemSerrado = Tables['itens_pacote_serrado']['Row'];
export type PacoteSerrado = Tables['pacotes_serrados']['Row'] & { itens: ItemSerrado[]; carga_id: string | null };
export type CargaSerrada = Tables['romaneios_madeira_serrada']['Row'] & { pacotes: PacoteSerrado[] };
export type CabPacote = { numero: string; data: string; observacoes: string; autex: string };
export type CabCarga = { numero_carga: string; data: string; cliente_nome: string; cliente_documento: string; motorista_nome: string; motorista_cpf: string; placa_veiculo: string; placa_reboque: string };

export function calcularBitola(item: BitolaSerrada) {
  let pecas = 0, volume = 0;
  for (const comprimento of COMPRIMENTOS) {
    const n = Number(item.distribuicao_pecas[comprimento] ?? 0);
    pecas += n;
    volume += item.grossura * item.largura * Number(comprimento) * n / 10000;
  }
  return { pecas, volume: Math.round((volume + Number.EPSILON) * 10000) / 10000 };
}
export function comoBitola(item: ItemSerrado): BitolaSerrada {
  const d = item.distribuicao_pecas;
  return { ...item, distribuicao_pecas: Object.fromEntries(COMPRIMENTOS.map(c => [c, d && typeof d === 'object' && !Array.isArray(d) ? Number(d[c] ?? 0) : 0])) };
}
export function resumoPacotes(pacotes: PacoteSerrado[]) {
  return pacotes.reduce((r, p) => {
    for (const i of p.itens) { r.pecas += i.total_pecas; r.volume += Number(i.volume_m3); r.bitolas++; }
    return r;
  }, { pecas: 0, volume: 0, bitolas: 0 });
}
export function validarBitolas(itens: BitolaSerrada[]) {
  if (!itens.length) throw new Error('Adicione pelo menos uma bitola');
  for (const i of itens) {
    if (!i.especie.trim() || !i.tipo_peca.trim() || !Number.isFinite(i.grossura) || !Number.isFinite(i.largura) || i.grossura <= 0 || i.largura <= 0) throw new Error('Preencha espécie, tipo de peça e medidas positivas');
    for (const [c, n] of Object.entries(i.distribuicao_pecas)) if (!COMPRIMENTOS.includes(c) || !Number.isSafeInteger(n) || n < 0) throw new Error('As quantidades devem ser inteiras e positivas ou zero');
    if (calcularBitola(i).pecas < 1) throw new Error('Adicione peças em cada bitola');
  }
}

export function madeiraQuery(empresa: string | null) {
  return { queryKey: ['madeira-serrada', empresa], enabled: !!empresa, networkMode: 'always' as const, queryFn: async () => {
    if (!empresa) return [];
    return comCache<PacoteSerrado>(`madeira-serrada:${empresa}`, async () => {
      const pacotes: PacoteSerrado[] = [];
      for (let from = 0; ; from += 500) {
        const { data, error } = await supabase.from('pacotes_serrados').select('*, itens_pacote_serrado(*), romaneio_carga_pacotes(romaneio_id)').eq('empresa_id', empresa).order('created_at', { ascending: false }).order('id').range(from, from + 499);
        if (error) throw new Error(error.message);
        pacotes.push(...(data ?? []).map(p => ({ ...p, itens: p.itens_pacote_serrado, carga_id: p.romaneio_carga_pacotes[0]?.romaneio_id ?? null })));
        if ((data?.length ?? 0) < 500) return pacotes;
      }
    });
  }};
}
export function autexSerradasQuery(empresa: string) {
  return { queryKey: ['autex-serradas', empresa], networkMode: 'always' as const, queryFn: () => comCache<{numero:string}>(`autex-serradas:${empresa}`, async () => {
    const { data, error } = await supabase.from('autex').select('numero').eq('empresa_id',empresa).order('numero');
    if(error) throw new Error(error.message);
    return data ?? [];
  }) };
}
export function cargasSerradasQuery(empresa: string | null) {
  return { queryKey: ['cargas-serradas', empresa], enabled: !!empresa, networkMode: 'always' as const, queryFn: async () => {
    if (!empresa) return [];
    return comCache<Tables['romaneios_madeira_serrada']['Row']>(`cargas-serradas:${empresa}`, async () => {
      const rows: Tables['romaneios_madeira_serrada']['Row'][] = [];
      for (let from = 0; ; from += 500) {
        const { data, error } = await supabase.from('romaneios_madeira_serrada').select('*').eq('empresa_id', empresa).order('created_at', { ascending: false }).order('id').range(from, from + 499);
        if (error) throw new Error(error.message);
        rows.push(...(data ?? []));
        if ((data?.length ?? 0) < 500) return rows;
      }
    });
  }};
}
function exigirConexao() { if (!navigator.onLine) throw new Error('Conecte à internet para salvar pacotes ou expedir cargas. Os dados preenchidos continuam nesta tela.'); }
export async function salvarPacote(empresa: string, id: string, cab: CabPacote, itens: BitolaSerrada[]) {
  exigirConexao(); validarBitolas(itens);
  const log = await capturarLog('Pacote de madeira serrada salvo', `Pacote ${cab.numero}`);
  const { error } = await supabase.rpc('salvar_pacote_serrado', { _empresa: empresa, _id: id, _cab: cab, _itens: itens as unknown as Json, _log: log as unknown as Json });
  if (error) throw new Error(error.message);
}
export async function excluirPacote(empresa: string, id: string) {
  exigirConexao();
  const log = await capturarLog('Pacote de madeira serrada excluído', id);
  const { error } = await supabase.rpc('excluir_pacote_serrado', { _empresa: empresa, _id: id, _log: log as unknown as Json });
  if (error) throw new Error(error.message);
}
export async function salvarCargaSerrada(empresa: string, id: string, cab: CabCarga, pacotes: string[]) {
  exigirConexao();
  const log = await capturarLog('Carga de madeira serrada expedida', cab.numero_carga);
  const { error } = await supabase.rpc('salvar_carga_serrada', { _empresa: empresa, _id: id, _cab: cab, _pacotes: pacotes, _log: log as unknown as Json });
  if (error) throw new Error(error.message);
}
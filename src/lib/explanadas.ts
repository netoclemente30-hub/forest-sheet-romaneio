import { supabase } from "@/integrations/supabase/client";
import { comCache } from './offline/cache';
import { fila } from './offline/fila';
import { capturarLog } from './registro';

export type Explanada = {
  id: string;
  empresa_id: string;
  autex: string;
  nome: string;
  latitude: number | null;
  longitude: number | null;
  criado_em: string;
};

export async function listarExplanadas(empresa: string, autex?: string): Promise<Explanada[]> {
  if (!empresa) return [];
  return comCache(`explanadas:${autex ?? ''}`, async () => {
  let q = supabase.from("explanadas" as "patios")
    .select("*").eq("empresa_id", empresa).order("nome");
  if (autex) q = q.filter("autex", "eq", autex);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Explanada[];
  }, empresa);
}

export async function cadastrarExplanada({
  empresa, autex, nome, latitude, longitude,
}: {
  empresa: string;
  autex: string;
  nome: string;
  latitude: number | null;
  longitude: number | null;
}): Promise<void> {
  const n = nome.trim();
  if (!empresa || !autex || n.length < 2 || n.length > 80)
    throw new Error("Informe empresa, AUTEX e nome da explanada (2 a 80 caracteres)");
  if ((latitude == null) !== (longitude == null))
    throw new Error("Informe as duas coordenadas ou nenhuma");
  if (latitude != null && longitude != null &&
    !(latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180))
    throw new Error("Coordenadas da explanada inválidas");
  await fila().enfileirar({ tipo: 'cadastro_upsert', tabela: 'explanadas', empresa_id: empresa, conflito: 'id', dados: { id: crypto.randomUUID(), autex, nome: n, latitude, longitude }, log: await capturarLog('Explanada cadastrada', `${autex} · ${n}`) });
}

import { supabase } from "@/integrations/supabase/client";

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
  // Tabela proposta para o banco administrado pela Lovable.
  let q = supabase.from("explanadas" as "patios")
    .select("*").eq("empresa_id", empresa).order("nome");
  if (autex) q = q.eq("autex", autex);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Explanada[];
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
  const { error } = await supabase.from("explanadas" as "patios")
    .insert({ empresa_id: empresa, autex, nome: n, latitude, longitude } as never);
  if (error) throw new Error(error.message);
}

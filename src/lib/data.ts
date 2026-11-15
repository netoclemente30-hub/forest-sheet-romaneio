import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getEmpresaAtiva } from "./empresa";
import { comCache } from "./offline/cache";

/** Dados projetados offline podem preceder a migração 0038 de arrasto. */
type ToraBanco = Database["public"]["Tables"]["toras"]["Row"];
type CamposArrasto = Pick<ToraBanco, "arrastada_em" | "arrastada_por" | "arrasto_operacao_id" | "arrasto_lat" | "arrasto_lng">;
export type Tora = Omit<ToraBanco, "publico_id" | keyof CamposArrasto> &
  Partial<CamposArrasto> & { publico_id?: string };
export type Arvore = Database["public"]["Tables"]["arvores"]["Row"];
export type Romaneio = Database["public"]["Tables"]["romaneios"]["Row"];
export type RastroGPS = Database["public"]["Tables"]["rastros_gps"]["Row"];

export const autexQuery = {
  networkMode: "always" as const,
  queryKey: ["autex"],
  queryFn: () =>
    comCache("autex", async () => {
      let q = supabase.from("autex").select("*").order("numero");
      const emp = getEmpresaAtiva();
      if (emp) q = q.eq("empresa_id", emp);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    }),
};

async function fetchAll<T>(table: "toras" | "arvores", order: string): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  const emp = getEmpresaAtiva();
  for (let from = 0; ; from += size) {
    let q = supabase
      .from(table)
      .select("*")
      .order(order, { ascending: true })
      .range(from, from + size - 1);
    if (emp) q = q.eq("empresa_id", emp);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < size) break;
  }
  return out;
}

export const torasQuery = {
  networkMode: "always" as const,
  queryKey: ["toras"],
  queryFn: () => comCache("toras", () => fetchAll<Tora>("toras", "plaqueta")),
};
export const arvoresQuery = {
  networkMode: "always" as const,
  queryKey: ["arvores"],
  queryFn: () => comCache("arvores", () => fetchAll<Arvore>("arvores", "numero")),
};
export const rastrosQuery = (autex: string) => ({
  networkMode: "always" as const,
  queryKey: ["rastros", autex],
  queryFn: () => comCache<RastroGPS>(`rastros:${autex}`, async () => {
    let q = supabase.from("rastros_gps").select("*").eq("autex", autex).order("capturado_em");
    const emp = getEmpresaAtiva();
    if (emp) q = q.eq("empresa_id", emp);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }),
});

export const romaneiosQuery = {
  networkMode: "always" as const,
  queryKey: ["romaneios"],
  queryFn: () =>
    comCache("romaneios", async () => {
      let q = supabase
        .from("romaneios")
        .select("*")
        .order("created_at", { ascending: false });
      const emp = getEmpresaAtiva();
      if (emp) q = q.eq("empresa_id", emp);
      const { data, error } = await q;
      if (error) throw error;
      return data as Romaneio[];
    }),
};

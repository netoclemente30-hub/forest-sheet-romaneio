import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Tora = Database["public"]["Tables"]["toras"]["Row"];
export type Arvore = Database["public"]["Tables"]["arvores"]["Row"];
export type Romaneio = Database["public"]["Tables"]["romaneios"]["Row"];

async function fetchAll<T>(table: "toras" | "arvores", order: string): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(order, { ascending: true })
      .range(from, from + size - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < size) break;
  }
  return out;
}

export const torasQuery = {
  queryKey: ["toras"],
  queryFn: () => fetchAll<Tora>("toras", "plaqueta"),
};
export const arvoresQuery = {
  queryKey: ["arvores"],
  queryFn: () => fetchAll<Arvore>("arvores", "numero"),
};
export const romaneiosQuery = {
  queryKey: ["romaneios"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("romaneios")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Romaneio[];
  },
};

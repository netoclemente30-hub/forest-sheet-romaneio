import { supabase } from "@/integrations/supabase/client";
import type { Arvore } from "@/lib/data";
import { comCache } from "@/lib/offline/cache";
import { validarAbateProximo } from "@/lib/exploracao";
import type { Coordenada } from "@/lib/exploracao";

export type ArrastoArvore = {
  id: string;
  empresa_id: string;
  autex: string;
  arvore: number;
  explanada_id: string | null;
  capturado_em: string;
  latitude: number;
  longitude: number;
  gps_precisao: number;
  operacao_id: string;
  realizado_por: string;
  criado_em: string;
};

export const arrastosArvoresQuery = (empresa: string, autex?: string) => ({
  networkMode: "always" as const,
  queryKey: ["arrastos-arvores", empresa, autex ?? "todas"],
  queryFn: () => comCache<ArrastoArvore>("arrastos-arvores:" + empresa + ":" + (autex ?? "todas"), async () => {
    let q = supabase.from("arrastos_arvores").select("*").eq("empresa_id", empresa)
      .order("capturado_em", { ascending: false });
    if (autex) q = q.eq("autex", autex);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  }),
});

export function chaveArrastoArvore(empresa: string, autex: string, arvore: number): string {
  return [empresa, autex, arvore].join(":");
}

/** O tratorista não depende do abate sincronizado: somente GPS + coordenadas da BASE. */
export function validarArrastoArvore(
  arvore: Pick<Arvore, "latitude" | "longitude" | "nao_abatida_motivo">,
  gps: Coordenada | null,
  agora = Date.now(),
): string | null {
  if (arvore.nao_abatida_motivo) return "Árvore marcada como não abatida. Regularize antes do arrasto.";
  if (arvore.latitude == null || arvore.longitude == null)
    return "Árvore sem coordenadas cadastradas; o tratorista precisa da localização na BASE.";
  const erro = validarAbateProximo(arvore, gps, agora);
  return erro ? erro.replace("abater esta árvore", "registrar o arrasto") : null;
}

export function conciliacaoArrasto(
  arrasto: ArrastoArvore | null | undefined,
  abatidaEm: string | null | undefined,
): "pendente" | "aguardando_abate" | "conciliado" {
  if (!arrasto) return "pendente";
  return abatidaEm ? "conciliado" : "aguardando_abate";
}

import { volumeTora } from "@/lib/volume";
import { medidaComercial } from "@/lib/medida-comercial";

export type ToraAguardando = {
  id: string; empresa_id: string; numero: number; especie: string; nome_cientifico: string | null;
  d_topo1: number; d_topo2: number; d_pe1: number; d_pe2: number; comprimento: number; volume: number; created_at: string;
};

export type MedidasAguardando = { d_topo1: number; d_topo2: number; d_pe1: number; d_pe2: number; comprimento: number };

/** Próximo número livre da sequência própria das toras aguardando identificação. */
export function proximoNumeroAguardando(lista: Pick<ToraAguardando, "numero">[]): number {
  return lista.reduce((m, t) => Math.max(m, t.numero), 0) + 1;
}

export function codigoAguardando(numero: number) { return `NI-${numero}`; }

/** Físico pelo Smalian do app e comercial pela ponta mais fina; null quando faltam medidas. */
export function volumesAguardando(m: { [K in keyof MedidasAguardando]?: number | undefined }) {
  const ok = [m.d_topo1, m.d_topo2, m.d_pe1, m.d_pe2, m.comprimento].every((n) => typeof n === "number" && Number.isFinite(n) && n > 0);
  if (!ok) return null;
  const fisico = volumeTora(m);
  return { fisico, comercial: medidaComercial({ ...m, volume: fisico }) };
}

export function qrAguardando(t: Pick<ToraAguardando, "id" | "empresa_id" | "numero" | "especie">) {
  return JSON.stringify({ v: 1, tipo: "nao_identificada", codigo: codigoAguardando(t.numero), id: t.id, empresa: t.empresa_id, especie: t.especie });
}

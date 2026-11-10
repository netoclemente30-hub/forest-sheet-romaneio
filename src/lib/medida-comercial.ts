import { volumeTora } from "@/lib/volume";

export type MedidasTora = {
  d_topo1?: number | null;
  d_topo2?: number | null;
  d_pe1?: number | null;
  d_pe2?: number | null;
  comprimento?: number | null;
  volume?: number | string | null;
};

export type MedidaComercial = {
  d1: number;
  d2: number;
  comprimento: number;
  volume: number;
  ponta: "topo" | "pe";
};

const valido = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/** Arredonda sempre para baixo, em passos de meio metro. */
export function comprimentoComercial(comprimento: number | null | undefined): number | null {
  if (!valido(comprimento)) return null;
  return Math.floor((comprimento + Number.EPSILON) * 2) / 2;
}

/**
 * Usa as duas medidas da ponta mais fina e o comprimento comercial.
 * O volume segue a mesma fórmula de Smalian do restante do app, com as duas
 * pontas iguais à ponta fina selecionada.
 */
export function medidaComercial(t: MedidasTora): MedidaComercial | null {
  const comprimento = comprimentoComercial(t.comprimento);
  if (comprimento === null || !valido(t.d_topo1) || !valido(t.d_topo2) || !valido(t.d_pe1) || !valido(t.d_pe2)) return null;
  const mediaTopo = (t.d_topo1 + t.d_topo2) / 2;
  const mediaPe = (t.d_pe1 + t.d_pe2) / 2;
  const ponta = mediaTopo <= mediaPe ? "topo" : "pe";
  const d1 = ponta === "topo" ? t.d_topo1 : t.d_pe1;
  const d2 = ponta === "topo" ? t.d_topo2 : t.d_pe2;
  const volume = volumeTora({ d_topo1: d1, d_topo2: d2, d_pe1: d1, d_pe2: d2, comprimento });
  return { d1, d2, comprimento, volume, ponta };
}

export function volumeComercial(t: MedidasTora): number {
  return medidaComercial(t)?.volume ?? 0;
}

export function totaisComerciais(itens: MedidasTora[]) {
  const fisico = itens.reduce((total, t) => total + Number(t.volume ?? 0), 0);
  const comercial = itens.reduce((total, t) => total + volumeComercial(t), 0);
  return { fisico, comercial, diferenca: comercial - fisico };
}

export const fmtComprimentoComercial = (valor: number) =>
  valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

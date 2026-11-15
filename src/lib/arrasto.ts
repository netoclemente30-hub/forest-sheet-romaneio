import type { Arvore, Tora } from "./data";
import type { Coordenada } from "./exploracao";
import { coordenadaValida, validarAbateProximo } from "./exploracao";

export type SituacaoArrasto = {
  total: number;
  arrastadas: Tora[];
  disponiveis: Tora[];
  carregadasSemArrasto: Tora[];
};

/** Uma tora é identificada pela plaqueta na empresa (não pelo número da árvore). */
export function situacaoArrasto(
  arvores: Pick<Arvore, "numero" | "autex">,
  empresa: string,
  toras: Tora[],
): SituacaoArrasto {
  const encontradas = toras.filter((t) =>
    t.empresa_id === empresa && t.autex === arvores.autex &&
    t.arvore === arvores.numero && t.origem === "manejo",
  );
  const unicas = [...new Map(encontradas.map((t) => [t.plaqueta, t])).values()]
    .sort((a, b) => (a.secao ?? "").localeCompare(b.secao ?? "", "pt-BR") || a.plaqueta - b.plaqueta);
  return {
    total: unicas.length,
    arrastadas: unicas.filter((t) => !!t.arrastada_em),
    disponiveis: unicas.filter((t) => !t.arrastada_em && !t.carregada && !t.romaneio_id),
    carregadasSemArrasto: unicas.filter((t) => !t.arrastada_em && (t.carregada || !!t.romaneio_id)),
  };
}

export function validarPosicaoArrasto(
  arvore: Pick<Arvore, "abatida_em" | "latitude" | "longitude">,
  posicao: Coordenada | null,
  agora = Date.now(),
): string | null {
  if (!arvore.abatida_em) return "Registre primeiro o abatimento desta árvore.";
  if (arvore.latitude == null || arvore.longitude == null ||
      !coordenadaValida(Number(arvore.latitude), Number(arvore.longitude))) {
    return "Localize a árvore no mapa antes de registrar o arrasto.";
  }
  const erro = validarAbateProximo(arvore, posicao, agora);
  return erro?.replace("abater esta árvore", "registrar o arrasto")
    ?? null;
}

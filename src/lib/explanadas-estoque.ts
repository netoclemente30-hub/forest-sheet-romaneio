import type { Tora } from "@/lib/data";
import type { ArrastoArvore } from "@/lib/arrasto-arvore";
import type { Explanada } from "@/lib/explanadas";

export function toraDisponivelExplanada(tora: Pick<Tora, "origem" | "arrastada_em" | "carregada" | "romaneio_id" | "serrada_em">): boolean {
  return tora.origem === "manejo" && !!tora.arrastada_em &&
    !tora.carregada && !tora.romaneio_id && !tora.serrada_em;
}

export function torasDaExplanada(toras: Tora[], explanada: Explanada): Tora[] {
  return toras.filter((t) =>
    t.empresa_id === explanada.empresa_id &&
    t.autex === explanada.autex &&
    t.origem === "manejo" &&
    t.arrasto_explanada_id === explanada.id,
  ).sort((a, b) => a.plaqueta - b.plaqueta);
}

export type ResumoExplanada = {
  disponiveis: number;
  volumeDisponivel: number;
  carregadas: number;
  outrasSaidas: number;
  torasVinculadas: number;
  fustesSemToras: number;
};

/** Contagem por plaqueta da empresa e AUTEX, sem tratar cargas como saldo presente. */
export function resumoExplanada(
  explanada: Explanada,
  toras: Tora[],
  arrastos: ArrastoArvore[] = [],
): ResumoExplanada {
  const vinculadas = torasDaExplanada(toras, explanada);
  const disponiveis = vinculadas.filter(toraDisponivelExplanada);
  const carregadas = vinculadas.filter((t) => t.carregada || !!t.romaneio_id);
  const outrasSaidas = vinculadas.filter((t) => !toraDisponivelExplanada(t) && !t.carregada && !t.romaneio_id);
  const arvoresComToras = new Set(toras.filter((t) =>
    t.empresa_id === explanada.empresa_id && t.autex === explanada.autex &&
    t.origem === "manejo",
  ).map((t) => t.arvore));
  const fustesSemToras = new Set(arrastos.filter((a) =>
    a.empresa_id === explanada.empresa_id &&
    a.autex === explanada.autex &&
    a.explanada_id === explanada.id &&
    !arvoresComToras.has(a.arvore),
  ).map((a) => a.arvore)).size;
  return {
    disponiveis: disponiveis.length,
    volumeDisponivel: disponiveis.reduce((total, t) =>
      total + (Number.isFinite(Number(t.volume)) ? Number(t.volume) : 0), 0),
    carregadas: carregadas.length,
    outrasSaidas: outrasSaidas.length,
    torasVinculadas: vinculadas.length,
    fustesSemToras,
  };
}

/** Protege também a interface; a RPC valida novamente as mesmas regras. */
export function validarTransferenciaTora(
  tora: Tora,
  origem: Explanada,
  destino: Explanada,
): string | null {
  if (origem.id === destino.id) return "Escolha outra explanada de destino";
  if (origem.empresa_id !== destino.empresa_id || origem.autex !== destino.autex)
    return "A transferência só pode ocorrer na mesma empresa e AUTEX";
  if (tora.empresa_id !== origem.empresa_id || tora.autex !== origem.autex)
    return "Tora de outra empresa ou AUTEX";
  if (tora.arrasto_explanada_id !== origem.id)
    return "A tora não está mais na explanada de origem";
  if (!toraDisponivelExplanada(tora))
    return "Somente toras arrastadas, disponíveis e não carregadas podem ser transferidas";
  return null;
}

import type { Tora } from "./data";
import { identidadeDoQr } from "./tora-qr";

export function resolverQrSerragem(raw: string, toras: Tora[], empresa: string | null | undefined): Tora {
  const id = identidadeDoQr(raw);
  const plaqueta = id?.plaqueta;
  if (!plaqueta) throw new Error("Etiqueta inválida. Leia o QR de uma tora.");
  if (!empresa) throw new Error("Aguarde carregar a empresa.");
  const tora = toras.find((t) => t.empresa_id === empresa && t.plaqueta === plaqueta);
  if (!tora) throw new Error(`Plaqueta ${plaqueta} não encontrada nesta empresa. Confira a etiqueta ou atualize os dados.`);
  // Etiquetas completas não podem abrir uma identidade diferente após reutilização da plaqueta.
  if (id && id.arvore !== undefined) {
    const etiqueta = id;
    if (etiqueta.arvore !== tora.arvore || (etiqueta.secao ?? "") !== (tora.secao ?? "") || (etiqueta.autex ?? "") !== (tora.autex ?? "")) {
      throw new Error("Esta etiqueta não corresponde à identidade atual da tora. Confira a plaqueta, árvore e AUTEX.");
    }
  }
  return tora;
}
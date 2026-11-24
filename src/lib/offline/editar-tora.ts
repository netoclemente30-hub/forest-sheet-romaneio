import type { Fila, ItemFila } from "./fila";
import type { Tora } from "@/lib/data";

export function toraLocalEditavel(
  tora: Tora,
  itens: ItemFila[],
  usuario: string | undefined,
): boolean {
  return itens.some(
    (i) =>
      i.usuario_id === usuario &&
      !!usuario &&
      !i.envio_iniciado &&
      i.op.tipo === "tora_insert" &&
      i.op.dados["empresa_id"] === tora.empresa_id &&
      i.op.dados["plaqueta"] === tora.plaqueta,
  );
}

/** Usa a mesma exclusão entre abas do envio; nunca reescreve uma resposta incerta. */
export async function corrigirToraLocal(
  fila: Fila,
  tora: Tora,
  dados: Record<string, unknown>,
): Promise<boolean> {
  const corrigir = async () => {
    const itens = await fila.listar();
    const item = itens.find(
      (i) =>
        i.op.tipo === "tora_insert" &&
        i.op.dados["empresa_id"] === tora.empresa_id &&
        i.op.dados["plaqueta"] === tora.plaqueta,
    );
    if (!item || item.op.tipo !== "tora_insert") return false;
    if (
      dados["plaqueta"] !== tora.plaqueta &&
      itens.some(
        (i) =>
          i.id !== item.id &&
          "empresa_id" in i.op &&
          i.op.empresa_id === tora.empresa_id &&
          (("plaquetas" in i.op && i.op.plaquetas.includes(tora.plaqueta)) ||
            ("plaqueta" in i.op && i.op.plaqueta === tora.plaqueta)),
      )
    )
      throw new Error(
        "Sincronize os lançamentos relacionados antes de trocar a plaqueta. As demais correções podem ser salvas agora.",
      );
    await fila.substituir(item.id, {
      ...item.op,
      dados: { ...item.op.dados, ...dados, empresa_id: tora.empresa_id },
    });
    return true;
  };
  return typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request("gestor-fila-sync", corrigir)
    : corrigir();
}

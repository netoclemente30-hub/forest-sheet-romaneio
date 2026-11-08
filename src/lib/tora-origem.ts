import type { Arvore, Romaneio, Tora } from "./data";
import type { ItemFila } from "./offline/fila";
import { torasEtiquetasOffline } from "./encaixe-salvar";

export type OrigemTora = "manejo" | "serraria";

export function validarBaseManejo(arvore: Arvore | undefined, empresa: string): boolean {
  return !!arvore && arvore.empresa_id === empresa;
}

export function torasDeManejo(toras: Tora[]): Tora[] {
  return toras.filter((t) => t.origem === "manejo");
}

export function patioDaTora(tora: Tora, romaneios: Romaneio[]): string | null {
  const rom = romaneios.find((r) => r.id === tora.romaneio_id && r.empresa_id === tora.empresa_id && r.recebido_em);
  return rom ? rom.patio || "Sem pátio" : tora.origem === "serraria" ? "Conferência de estoque" : null;
}

/** Project local operations without inserting duplicate rows into the inventory. */
export function estoqueComFila(toras: Tora[], itens: ItemFila[], empresa: string | null): Tora[] {
  if (!empresa) return toras;
  const lista = [...toras];
  for (const t of torasEtiquetasOffline(itens, empresa)) {
    if (!lista.some((x) => x.empresa_id === empresa && x.plaqueta === t.plaqueta)) lista.push(t);
  }
  for (const { op } of itens) {
    if (!("empresa_id" in op) || op.empresa_id !== empresa) continue;
    if (op.tipo === "tora_delete") {
      const i = lista.findIndex((t) => t.empresa_id === empresa && t.plaqueta === op.plaqueta);
      if (i >= 0) lista.splice(i, 1);
    }
    if (op.tipo === "toras_serradas") {
      for (let i = 0; i < lista.length; i++) {
        const t = lista[i];
        if (t && t.empresa_id === empresa && op.plaquetas.includes(t.plaqueta)) lista[i] = { ...t, serrada_em: op.desfazer ? null : op.log?.criado_em ?? new Date().toISOString() };
      }
    }
  }
  return lista;
}
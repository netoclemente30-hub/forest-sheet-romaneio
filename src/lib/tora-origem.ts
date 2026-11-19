import type { Arvore, Romaneio, Tora } from "./data";
import type { ItemFila } from "./offline/fila";
import { torasEtiquetasOffline } from "./encaixe-salvar";
import { projetarDados } from './offline/projecao';

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
  const lista = projetarDados('toras', toras, itens, empresa);
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
/** Queued yard receipt for a load (same company), if any. */
export function recebimentoPendente(itens: ItemFila[], romaneioId: string, empresa: string | null) {
  for (const { op, erro } of itens) {
    if (op.tipo === "romaneio_recebido" && op.id === romaneioId && (!empresa || !op.empresa_id || op.empresa_id === empresa)) {
      return { patio: op.patio, em: op.log?.criado_em ?? null, erro: erro ?? null };
    }
  }
  return null;
}

/** Show queued receipts locally, without creating loads or copying logs. */
export function romaneiosComFila(romaneios: Romaneio[], itens: ItemFila[], empresa: string | null): Romaneio[] {
  return romaneios.map((r) => {
    if (r.recebido_em) return r;
    const p = recebimentoPendente(itens, r.id, empresa ?? r.empresa_id ?? null);
    return p && !p.erro ? { ...r, recebido_em: p.em ?? new Date().toISOString(), patio: p.patio } : r;
  });
}

export type ConferenciaCarga = { ok: true } | { ok: false; motivo: string };

/** The QR must describe exactly the logs linked to the load in the database, in the expected company. */
export function conferirCargaQr(
  qrPlaquetas: number[], romaneio: Pick<Romaneio, "empresa_id">, toras: Pick<Tora, "plaqueta" | "empresa_id">[], empresaEsperada: string | null,
): ConferenciaCarga {
  if (empresaEsperada && romaneio.empresa_id !== empresaEsperada) return { ok: false, motivo: "Esta carga pertence a outra empresa" };
  if (toras.some((t) => t.empresa_id !== romaneio.empresa_id)) return { ok: false, motivo: "Há toras de outra empresa nesta carga" };
  const banco = [...new Set(toras.map((t) => t.plaqueta))].sort((a, b) => a - b);
  const qr = [...new Set(qrPlaquetas)].sort((a, b) => a - b);
  if (banco.length !== qr.length || banco.some((p, i) => p !== qr[i])) return { ok: false, motivo: "As toras do QR não conferem com a carga registrada. Confira o romaneio antes de receber" };
  return { ok: true };
}

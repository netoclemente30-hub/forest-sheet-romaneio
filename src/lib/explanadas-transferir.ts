import type { Tora } from "@/lib/data";
import type { Explanada } from "@/lib/explanadas";
import { validarTransferenciaTora } from "@/lib/explanadas-estoque";
import { capturarLog } from "@/lib/registro";
import { fila, type Op } from "@/lib/offline/fila";
import { estaOnline, executarOp } from "@/lib/offline/sync";

export async function transferirToraExplanada(
  tora: Tora, origem: Explanada, destino: Explanada,
): Promise<{ offline: boolean }> {
  const erro = validarTransferenciaTora(tora, origem, destino);
  if (erro) throw new Error(erro);
  const log = await capturarLog("Transferência entre explanadas",
    "Plaqueta " + tora.plaqueta + " · árvore " + tora.arvore +
      " · AUTEX " + origem.autex + " · " + origem.nome + " → " + destino.nome);
  const op: Extract<Op, { tipo: "transferencia_explanada" }> = {
    tipo: "transferencia_explanada",
    empresa_id: origem.empresa_id,
    autex: origem.autex,
    plaqueta: tora.plaqueta,
    origem_id: origem.id,
    destino_id: destino.id,
    log,
  };
  await fila().enfileirar(op);
  return { offline: true };
}

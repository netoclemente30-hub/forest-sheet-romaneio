import type { Arvore } from "@/lib/data";
import type { Coordenada } from "@/lib/exploracao";
import { validarArrastoArvore } from "@/lib/arrasto-arvore";
import { capturarLog } from "@/lib/registro";
import { fila, type Op } from "@/lib/offline/fila";
import { estaOnline, executarOp } from "@/lib/offline/sync";

function falhaRede(e: unknown): boolean {
  return !estaOnline() || /network|fetch|timeout|connection|abort/i.test(
    e instanceof Error ? e.message : String(e),
  );
}

export async function registrarArrastoArvore({
  arvore, empresa, explanadaId, gps,
}: {
  arvore: Arvore;
  empresa: string;
  explanadaId: string | null;
  gps: Coordenada;
}): Promise<{ offline: boolean; op: Extract<Op, { tipo: "arrasto_arvore" }> }> {
  if (!empresa || arvore.empresa_id !== empresa)
    throw new Error("Empresa da árvore incompatível com a empresa selecionada");
  const erroGps = validarArrastoArvore(arvore, gps);
  if (erroGps) throw new Error(erroGps);
  if (gps.precisao == null || !gps.capturado_em)
    throw new Error("Capture a posição GPS do tratorista no local");
  const log = await capturarLog("Arrasto da árvore registrado",
    "Árvore " + arvore.numero + " · AUTEX " + arvore.autex +
    " · " + (explanadaId ? "explanada " + explanadaId : "destino a definir"));
  log.lat = gps.lat;
  log.lng = gps.lng;
  log.criado_em = gps.capturado_em;
  const op: Extract<Op, { tipo: "arrasto_arvore" }> = {
    tipo: "arrasto_arvore",
    empresa_id: empresa,
    autex: arvore.autex,
    arvore: arvore.numero,
    explanada_id: explanadaId,
    latitude: gps.lat,
    longitude: gps.lng,
    precisao: gps.precisao,
    capturado_em: gps.capturado_em,
    log,
  };
  if (estaOnline()) {
    try {
      await executarOp(op);
      return { offline: false, op };
    } catch (e) {
      if (!falhaRede(e)) throw e;
    }
  }
  await fila().enfileirar(op);
  return { offline: true, op };
}

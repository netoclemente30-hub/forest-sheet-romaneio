import type { Arvore } from "./data";
import type { Coordenada } from "./exploracao";
import { validarPosicaoArrasto } from "./arrasto";
import { capturarLog } from "./registro";
import { fila, type Op } from "./offline/fila";
import { estaOnline, executarOp } from "./offline/sync";

function erroRede(error: unknown): boolean {
  return !estaOnline() || /fetch|network|failed to fetch/i.test(
    error instanceof Error ? error.message : String(error),
  );
}

export async function registrarArrasto({
  arvore, empresa, plaquetas, explanadaId, gps,
}: {
  arvore: Arvore;
  empresa: string;
  plaquetas: number[];
  explanadaId: string;
  gps: Coordenada;
}): Promise<{ offline: boolean; op: Extract<Op, { tipo: "arrasto_toras" }> }> {
  const erroGps = validarPosicaoArrasto(arvore, gps);
  if (erroGps) throw new Error(erroGps);
  if (!empresa || arvore.empresa_id !== empresa)
    throw new Error("Empresa da árvore não corresponde à empresa selecionada");
  if (!explanadaId) throw new Error("Escolha a explanada onde deixou as toras");
  if (!plaquetas.length || new Set(plaquetas).size !== plaquetas.length)
    throw new Error("Selecione pelo menos uma tora sem repetições");
  if (!gps.capturado_em || gps.precisao == null)
    throw new Error("Capture uma posição GPS recente");
  const log = await capturarLog(
    "Arrasto concluído",
    "Árvore " + arvore.numero + " · AUTEX " + arvore.autex +
      " · " + plaquetas.length + " toras · plaquetas " + plaquetas.join(", "),
  );
  log.lat = gps.lat;
  log.lng = gps.lng;
  log.criado_em = gps.capturado_em;
  const op: Extract<Op, { tipo: "arrasto_toras" }> = {
    tipo: "arrasto_toras",
    empresa_id: empresa,
    autex: arvore.autex,
    arvore: arvore.numero,
    plaquetas,
    explanada_id: explanadaId,
    latitude: gps.lat,
    longitude: gps.lng,
    precisao: gps.precisao,
    capturado_em: gps.capturado_em,
    log,
  };
  await fila().enfileirar(op);
  return { offline: true, op };
}

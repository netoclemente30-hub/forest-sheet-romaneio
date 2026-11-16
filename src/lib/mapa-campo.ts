import type { Arvore } from "./data";
import type { ArrastoArvore } from "./arrasto-arvore";
import type { Coordenada } from "./exploracao";
import { coordenadaValida, distanciaMetros, validarAbateProximo } from "./exploracao";
import { validarArrastoArvore } from "./arrasto-arvore";

export const LARGURA_MAPA = 640;
export const ALTURA_MAPA = 420;
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 12;

export function limitarZoom(valor: number): number {
  if (!Number.isFinite(valor)) return ZOOM_MIN;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, valor));
}

/** Mantém os limites do mapa visíveis mesmo ao arrastar/zoom. */
export function centroMapa(x: number, y: number, zoom: number) {
  const z = limitarZoom(zoom);
  const meioX = LARGURA_MAPA / (2 * z);
  const meioY = ALTURA_MAPA / (2 * z);
  const normalizar = (v: number, base: number) => Number.isFinite(v) ? v : base;
  return {
    x: Math.max(meioX, Math.min(LARGURA_MAPA - meioX, normalizar(x, LARGURA_MAPA / 2))),
    y: Math.max(meioY, Math.min(ALTURA_MAPA - meioY, normalizar(y, ALTURA_MAPA / 2))),
  };
}

export function janelaMapa(x: number, y: number, zoom: number) {
  const z = limitarZoom(zoom);
  const centro = centroMapa(x, y, z);
  const w = LARGURA_MAPA / z, h = ALTURA_MAPA / z;
  return [centro.x - w / 2, centro.y - h / 2, w, h] as const;
}

export type AcaoCampo = "abater" | "arrastar";
export type ArvorePerto = { arvore: Arvore; distancia: number; acao: AcaoCampo };

/** Sugestão visual, nunca execução automática. As operações refazem a validação no clique. */
export function acoesProximasMapa(
  arvores: Arvore[],
  gps: Coordenada | null,
  podeAbater: boolean,
  podeArrastar: boolean,
  arrastos: Pick<ArrastoArvore, "empresa_id" | "autex" | "arvore">[],
  empresa: string | null,
  agora = Date.now(),
): ArvorePerto[] {
  if (!empresa || !gps || !coordenadaValida(gps.lat, gps.lng)) return [];
  const resultado: ArvorePerto[] = [];
  for (const arvore of arvores) {
    if (arvore.empresa_id !== empresa ||
        arvore.latitude == null || arvore.longitude == null ||
        !coordenadaValida(Number(arvore.latitude), Number(arvore.longitude))) continue;
    const distancia = distanciaMetros(gps, {
      lat: Number(arvore.latitude), lng: Number(arvore.longitude),
    });
    if (distancia > 100) continue;

    if (podeAbater && !arvore.abatida_em && !arvore.nao_abatida_motivo &&
        !validarAbateProximo(arvore, gps, agora))
      resultado.push({ arvore, distancia, acao: "abater" });

    if (podeArrastar && !arrastos.some((a) =>
      a.empresa_id === empresa && a.autex === arvore.autex && a.arvore === arvore.numero
    ) && !validarArrastoArvore(arvore, gps, agora))
      resultado.push({ arvore, distancia, acao: "arrastar" });
  }
  return resultado.sort((a, b) => a.distancia - b.distancia || a.arvore.numero - b.arvore.numero);
}

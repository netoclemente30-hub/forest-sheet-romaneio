import type { Coordenada } from "./exploracao";
import { coordenadaValida, distanciaMetros } from "./exploracao";

export type Matriz = [number, number, number, number, number, number];
export type GeoReferencia = { pagina: number; bbox: number[]; crs: string; matriz: Matriz };
export type MapaRenderizado = { imagem: string; largura: number; altura: number; viewport: Matriz; geo: GeoReferencia };
function numero(ns: number[], i: number): number {
  const n = ns[i];
  if (n === undefined || !Number.isFinite(n)) throw new Error("Controle geográfico incompleto");
  return n;
}

export function aplicarMatriz(m: Matriz, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
export function inverterMatriz(m: Matriz): Matriz {
  const d = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(d) < 1e-12) throw new Error("Coordenadas do mapa não permitem alinhamento seguro");
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d];
}
export function ajustarControle(local: number[], mundo: number[]): Matriz {
  if (local.length < 6 || local.length !== mundo.length || [...local, ...mundo].some((n) => !Number.isFinite(n))) throw new Error("Controle geográfico inválido no PDF");
  // Use a non-collinear triple and validate ALL remaining controls.
  for (let i = 2; i < local.length / 2; i++) {
    const base: Matriz = [numero(local, 2) - numero(local, 0), numero(local, 3) - numero(local, 1), numero(local, i * 2) - numero(local, 0), numero(local, i * 2 + 1) - numero(local, 1), numero(local, 0), numero(local, 1)];
    if (Math.abs(base[0] * base[3] - base[1] * base[2]) < 1e-8) continue;
    const inv = inverterMatriz(base);
    const a = numero(mundo, 2) - numero(mundo, 0), b = numero(mundo, 3) - numero(mundo, 1), c = numero(mundo, i * 2) - numero(mundo, 0), d = numero(mundo, i * 2 + 1) - numero(mundo, 1);
    const m: Matriz = [a * inv[0] + c * inv[1], b * inv[0] + d * inv[1], a * inv[2] + c * inv[3], b * inv[2] + d * inv[3], a * inv[4] + c * inv[5] + numero(mundo, 0), b * inv[4] + d * inv[5] + numero(mundo, 1)];
    for (let j = 0; j < local.length; j += 2) {
      const [x, y] = aplicarMatriz(m, numero(local, j), numero(local, j + 1));
      if (Math.hypot(x - numero(mundo, j), y - numero(mundo, j + 1)) > 3) throw new Error("Alinhamento do GeoPDF inconsistente; confira o arquivo original");
    }
    return m;
  }
  throw new Error("Controle geográfico sem área válida");
}

export function arvoresProximas<T extends { id: string; numero: number; latitude: number | null; longitude: number | null; abatida_em: string | null }>(arvores: T[], posicao: Coordenada | null, raio: number) {
  if (!posicao || !coordenadaValida(posicao.lat, posicao.lng) || (posicao.precisao != null && posicao.precisao > 100)) return [];
  return arvores.flatMap((arvore) => {
    if (arvore.abatida_em || arvore.latitude == null || arvore.longitude == null || !coordenadaValida(Number(arvore.latitude), Number(arvore.longitude))) return [];
    const distancia = distanciaMetros(posicao, { lat: Number(arvore.latitude), lng: Number(arvore.longitude) });
    return distancia <= raio ? [{ arvore, distancia }] : [];
  }).sort((a, b) => a.distancia - b.distancia || a.arvore.numero - b.arvore.numero);
}

export async function lerGeoReferencia(bytes: Uint8Array): Promise<GeoReferencia> {
  const { PDFDocument, PDFName, PDFArray, PDFDict, PDFNumber, PDFString, PDFHexString } = await import("pdf-lib");
  const proj4 = (await import("proj4")).default;
  const doc = await PDFDocument.load(bytes);
  const nums = (obj: unknown): number[] => obj instanceof PDFArray ? obj.asArray().map((x) => { const n = doc.context.lookup(x); return n instanceof PDFNumber ? n.asNumber() : NaN; }) : [];
  for (const [index, page] of doc.getPages().entries()) {
    const vps = page.node.lookupMaybe(PDFName.of("VP"), PDFArray);
    if (!vps) continue;
    for (const ref of vps.asArray()) {
      const vp = doc.context.lookup(ref);
      if (!(vp instanceof PDFDict)) continue;
      const measure = vp.lookupMaybe(PDFName.of("Measure"), PDFDict);
      if (!measure || measure.get(PDFName.of("Subtype"))?.toString() !== "/GEO") continue;
      const gcs = measure.lookupMaybe(PDFName.of("GCS"), PDFDict);
      const wkt = gcs?.lookup(PDFName.of("WKT"));
      const epsg = gcs?.lookup(PDFName.of("EPSG"));
      let crs = wkt instanceof PDFString || wkt instanceof PDFHexString ? wkt.decodeText() : "";
      if (!crs && epsg instanceof PDFNumber) {
        const code = epsg.asNumber();
        if (code === 4326) crs = "EPSG:4326";
        else if (code >= 31978 && code <= 31985) crs = `+proj=utm +zone=${code - 31960} +south +ellps=GRS80 +units=m +no_defs`;
        else if (code >= 32601 && code <= 32660) crs = `+proj=utm +zone=${code - 32600} +datum=WGS84 +units=m +no_defs`;
        else if (code >= 32701 && code <= 32760) crs = `+proj=utm +zone=${code - 32700} +south +datum=WGS84 +units=m +no_defs`;
      }
      if (!crs) throw new Error("Sistema de coordenadas do GeoPDF não reconhecido");
      const bbox = nums(vp.lookup(PDFName.of("BBox")));
      const lpts = nums(measure.lookup(PDFName.of("LPTS"))), gpts = nums(measure.lookup(PDFName.of("GPTS")));
      if (bbox.length !== 4 || lpts.length !== gpts.length) throw new Error("GeoPDF com coordenadas incompletas");
      const local: number[] = [], mundo: number[] = [];
      for (let j = 0; j < lpts.length; j += 2) {
        if (!coordenadaValida(numero(gpts, j), numero(gpts, j + 1))) throw new Error("Coordenadas geográficas inválidas no PDF");
        local.push(numero(bbox, 0) + numero(lpts, j) * (numero(bbox, 2) - numero(bbox, 0)), numero(bbox, 1) + numero(lpts, j + 1) * (numero(bbox, 3) - numero(bbox, 1)));
        const xy: [number, number] = [numero(gpts, j + 1), numero(gpts, j)];
        const convertido = proj4("EPSG:4326", crs, xy);
        mundo.push(convertido[0], convertido[1]);
      }
      return { pagina: index + 1, bbox, crs, matriz: ajustarControle(local, mundo) };
    }
  }
  throw new Error("Este PDF não contém georreferenciamento compatível (GeoPDF /Measure /GEO). Envie o GeoPDF original; o PDF comum continua disponível em Abrir PDF.");
}

export async function renderizarGeoPdf(bytes: Uint8Array): Promise<MapaRenderizado> {
  const geo = await lerGeoReferencia(bytes);
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: bytes.slice() });
  try {
    const doc = await task.promise, page = await doc.getPage(geo.pagina);
    const natural = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2, 4096 / Math.max(natural.width, natural.height)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível desenhar o mapa neste aparelho");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return { imagem: canvas.toDataURL("image/png"), largura: viewport.width, altura: viewport.height, viewport: viewport.transform as Matriz, geo };
  } finally { await task.destroy(); }
}

export async function conversorMapa(mapa: MapaRenderizado) {
  const proj4 = (await import("proj4")).default;
  return {
    tela(pos: Coordenada): [number, number] {
      const xy: [number, number] = [pos.lng, pos.lat];
      const mundo = proj4("EPSG:4326", mapa.geo.crs, xy);
      const pdf = aplicarMatriz(inverterMatriz(mapa.geo.matriz), mundo[0], mundo[1]);
      return aplicarMatriz(mapa.viewport, pdf[0], pdf[1]);
    },
    gps(x: number, y: number): Coordenada {
      const pdf = aplicarMatriz(inverterMatriz(mapa.viewport), x, y);
      const mundo = aplicarMatriz(mapa.geo.matriz, pdf[0], pdf[1]);
      const [lng, lat] = proj4(mapa.geo.crs, "EPSG:4326", mundo);
      if (!coordenadaValida(lat, lng)) throw new Error("Ponto fora das coordenadas válidas do mapa");
      return { lat, lng, precisao: null };
    },
  };
}
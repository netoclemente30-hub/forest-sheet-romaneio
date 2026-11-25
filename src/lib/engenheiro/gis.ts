import proj4 from "proj4";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import type { Polygon, MultiPolygon } from "geojson";

export type Coordenada = { latitude: number; longitude: number };
export function projecaoUTM(zona: number, hemisferio: "S" | "N") {
  if (hemisferio !== "S" && hemisferio !== "N") throw new Error("Hemisfério inválido.");
  if (!Number.isInteger(zona) || zona < 1 || zona > 60) throw new Error("Zona UTM inválida.");
  return `+proj=utm +zone=${zona} ${hemisferio === "S" ? "+south" : ""} +ellps=GRS80 +towgs84=0,0,0 +units=m +no_defs`;
}
export function validarCoordenada(c: Coordenada) {
  if (
    !Number.isFinite(c.latitude) ||
    !Number.isFinite(c.longitude) ||
    Math.abs(c.latitude) > 90 ||
    Math.abs(c.longitude) > 180
  )
    throw new Error("Coordenada WGS84 inválida.");
  return c;
}
export function paraUTM(c: Coordenada, zona: number, hemisferio: "S" | "N") {
  validarCoordenada(c);
  if (c.latitude < -80 || c.latitude > 84 || (hemisferio === "S" ? c.latitude > 0 : c.latitude < 0))
    throw new Error("Latitude incompatível com UTM/hemisfério.");
  const [x, y] = proj4("EPSG:4326", projecaoUTM(zona, hemisferio), [c.longitude, c.latitude]);
  return { x: x!, y: y!, zona, hemisferio };
}
export function deUTM(x: number, y: number, zona: number, hemisferio: "S" | "N"): Coordenada {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 100000 ||
    x > 900000 ||
    y < 0 ||
    y > 10000000
  )
    throw new Error("Coordenadas UTM fora do intervalo.");
  const [longitude, latitude] = proj4(projecaoUTM(zona, hemisferio), "EPSG:4326", [x, y]);
  const c = validarCoordenada({ latitude: latitude!, longitude: longitude! });
  paraUTM(c, zona, hemisferio);
  return c;
}
export function dentro(c: Coordenada, poligonos: (Polygon | MultiPolygon)[]) {
  validarCoordenada(c);
  return poligonos.some((p) =>
    booleanPointInPolygon([c.longitude, c.latitude], p, { ignoreBoundary: false }),
  );
}
export function distanciaMetros(a: Coordenada, b: Coordenada) {
  validarCoordenada(a);
  validarCoordenada(b);
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

/** Local UTM grid, sampled in projected metres; avoids treating parallels as northings. */
export function gradeUTM(
  sul: number,
  oeste: number,
  norte: number,
  leste: number,
  zona: number,
  hemisferio: "S" | "N",
) {
  const cantos = [
    { latitude: sul, longitude: oeste },
    { latitude: norte, longitude: leste },
    { latitude: sul, longitude: leste },
    { latitude: norte, longitude: oeste },
  ].map((c) => paraUTM(c, zona, hemisferio));
  const minX = Math.max(100000, Math.min(...cantos.map((c) => c.x))),
    maxX = Math.min(900000, Math.max(...cantos.map((c) => c.x)));
  const minY = Math.max(0, Math.min(...cantos.map((c) => c.y))),
    maxY = Math.min(10000000, Math.max(...cantos.map((c) => c.y)));
  const passo = 10 ** Math.floor(Math.log10(Math.max(maxX - minX, maxY - minY, 1) / 5));
  const linhas: { rotulo: string; pontos: Coordenada[] }[] = [];
  for (let x = Math.ceil(minX / passo) * passo; x <= maxX && linhas.length < 80; x += passo)
    linhas.push({
      rotulo: `E ${Math.round(x)} m`,
      pontos: Array.from({ length: 9 }, (_, i) =>
        deUTM(x, minY + ((maxY - minY) * i) / 8, zona, hemisferio),
      ),
    });
  for (let y = Math.ceil(minY / passo) * passo; y <= maxY && linhas.length < 160; y += passo)
    linhas.push({
      rotulo: `N ${Math.round(y)} m`,
      pontos: Array.from({ length: 9 }, (_, i) =>
        deUTM(minX + ((maxX - minX) * i) / 8, y, zona, hemisferio),
      ),
    });
  return linhas;
}

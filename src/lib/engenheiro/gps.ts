import { gpx } from "@tmcw/togeojson";
import { validarCoordenada } from "./gis";

export type PontoTrilha = { latitude: number; longitude: number; altitude?: number; tempo: string };

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function paraGpx(pontos: PontoTrilha[], nome = "Trilha Gestor Florestal") {
  if (!pontos.length) throw new Error("Trilha vazia.");
  const pts = pontos
    .map((p) => {
      validarCoordenada(p);
      return `<trkpt lat="${p.latitude.toFixed(7)}" lon="${p.longitude.toFixed(7)}">${
        p.altitude !== undefined ? `<ele>${p.altitude.toFixed(1)}</ele>` : ""
      }<time>${esc(p.tempo)}</time></trkpt>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Gestor Florestal" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${esc(nome)}</name><trkseg>${pts}</trkseg></trk></gpx>`;
}

export function lerGpx(texto: string): PontoTrilha[] {
  const xml = new DOMParser().parseFromString(texto, "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("GPX inválido.");
  const fc = gpx(xml);
  const pontos: PontoTrilha[] = [];
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    const linhas =
      g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
    for (const l of linhas)
      for (const c of l)
        pontos.push({
          longitude: c[0]!,
          latitude: c[1]!,
          ...(c[2] !== undefined ? { altitude: c[2] } : {}),
          tempo: "",
        });
  }
  if (!pontos.length) throw new Error("GPX sem trilha (trk/rte).");
  pontos.forEach((p) => validarCoordenada(p));
  return pontos;
}

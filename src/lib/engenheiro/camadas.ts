import { kml } from "@tmcw/togeojson";
import type { FeatureCollection, Polygon, MultiPolygon, Position } from "geojson";
import { validarCoordenada } from "./gis";
import type { Estado, Camada } from "./projeto";
import { avaliarArvore } from "./inventario";
import { area as turfArea, buffer as turfBuffer } from "@turf/turf";
import type { Feature } from "geojson";

export function hectares(geojson: FeatureCollection) {
  return turfArea(geojson) / 10000;
}
export function gerarBufferAPP(
  hidrografia: FeatureCollection,
  distanciaM: 30 | 50 | 100,
): FeatureCollection {
  if (
    !hidrografia.features.length ||
    hidrografia.features.some(
      (f) => !["LineString", "MultiLineString", "Point", "MultiPoint"].includes(f.geometry.type),
    )
  )
    throw new Error("APP automática exige linhas de hidrografia ou pontos de nascentes.");
  const buffered = hidrografia.features
    .map((f) => turfBuffer(f, distanciaM, { units: "meters" }))
    .filter((f): f is Feature<Polygon | MultiPolygon> => !!f);
  if (!buffered.length) throw new Error("Não foi possível calcular o buffer.");
  return validarCamada({ type: "FeatureCollection", features: buffered });
}
export function importarGPX(xmlText: string): FeatureCollection {
  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("GPX inválido.");
  const features: FeatureCollection["features"] = [];
  const pts = [...xml.querySelectorAll("trk trkseg trkpt,rte rtept")].map(
    (el) => [Number(el.getAttribute("lon")), Number(el.getAttribute("lat"))] as [number, number],
  );
  if (pts.length > 1)
    features.push({
      type: "Feature",
      properties: { tipo: "trilha-gps" },
      geometry: { type: "LineString", coordinates: pts },
    });
  for (const el of xml.querySelectorAll("wpt"))
    features.push({
      type: "Feature",
      properties: { nome: el.querySelector("name")?.textContent ?? "Waypoint" },
      geometry: {
        type: "Point",
        coordinates: [Number(el.getAttribute("lon")), Number(el.getAttribute("lat"))],
      },
    });
  return validarCamada({ type: "FeatureCollection", features });
}
export function exportarGPX(f: FeatureCollection) {
  const pontos = f.features.flatMap((x) =>
    x.geometry.type === "LineString"
      ? x.geometry.coordinates.map((c) => `<trkpt lat="${c[1]}" lon="${c[0]}"/>`)
      : x.geometry.type === "Point"
        ? [
            `<wpt lat="${x.geometry.coordinates[1]}" lon="${x.geometry.coordinates[0]}"><name>${String(x.properties?.["nome"] ?? "Ponto").replace(/[<>&"']/g, "")}</name></wpt>`,
          ]
        : [],
  );
  return `<?xml version="1.0"?><gpx version="1.1" creator="Gestor Florestal" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Trilha GPS</name><trkseg>${pontos.filter((p) => p.startsWith("<trkpt")).join("")}</trkseg></trk>${pontos.filter((p) => p.startsWith("<wpt")).join("")}</gpx>`;
}

export function validarCamada(value: unknown): FeatureCollection {
  const fc = value as FeatureCollection;
  if (!fc || fc.type !== "FeatureCollection" || !Array.isArray(fc.features) || !fc.features.length)
    throw new Error("Informe uma FeatureCollection não vazia.");
  const pos = (p: Position) => {
    if (!Array.isArray(p) || p.length < 2) throw new Error("Coordenada incompleta.");
    validarCoordenada({ longitude: p[0]!, latitude: p[1]! });
  };
  const linha = (a: Position[]) => {
    if (!Array.isArray(a) || a.length < 2) throw new Error("Linha inválida.");
    a.forEach(pos);
  };
  const pol = (rings: Position[][]) => {
    if (!rings.length) throw new Error("Polígono vazio.");
    rings.forEach((r) => {
      linha(r);
      if (r.length < 4 || r[0]![0] !== r.at(-1)![0] || r[0]![1] !== r.at(-1)![1])
        throw new Error("Anel não fechado.");
    });
  };
  for (const f of fc.features) {
    if (f.type !== "Feature" || !f.geometry) throw new Error("Feição sem geometria.");
    const g = f.geometry;
    switch (g.type) {
      case "Point":
        pos(g.coordinates);
        break;
      case "LineString":
        linha(g.coordinates);
        break;
      case "MultiLineString":
        g.coordinates.forEach(linha);
        break;
      case "Polygon":
        pol(g.coordinates);
        break;
      case "MultiPolygon":
        g.coordinates.forEach(pol);
        break;
      default:
        throw new Error("Geometria não suportada.");
    }
  }
  if ("crs" in fc)
    throw new Error(
      "Remova a declaração CRS após converter para WGS84. Não inferimos projeção de camadas.",
    );
  return fc;
}
export function importarCamada(texto: string, nome: string): FeatureCollection {
  if (/\.kml$/i.test(nome)) {
    const xml = new DOMParser().parseFromString(texto, "application/xml");
    if (xml.querySelector("parsererror")) throw new Error("KML inválido.");
    return validarCamada(kml(xml));
  }
  return validarCamada(JSON.parse(texto));
}
export function poligonos(
  s: Estado,
  projetoId: string,
  tipo: Camada["tipo"],
  ut?: string,
): (Polygon | MultiPolygon)[] {
  return s.camadas
    .filter(
      (c) => c.projetoId === projetoId && c.tipo === tipo && (ut === undefined || c.ut === ut),
    )
    .flatMap((c) =>
      c.geojson.features.flatMap((f) =>
        f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon" ? [f.geometry] : [],
      ),
    );
}
export function avaliarCenso(s: Estado, projetoId: string) {
  return s.censo
    .filter((a) => a.projetoId === projetoId)
    .map(({ projetoId: _, ...a }) => {
      const especie = s.especies.find((e) => e.projetoId === projetoId && e.codigo === a.especieId);
      if (!especie) throw new Error("Espécie ausente.");
      const { projetoId: __, ...e } = especie;
      return avaliarArvore(
        a,
        e,
        poligonos(s, projetoId, "APP"),
        poligonos(s, projetoId, "UTs", a.ut),
      );
    });
}

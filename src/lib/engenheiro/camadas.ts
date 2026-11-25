import { kml } from "@tmcw/togeojson";
import type { FeatureCollection, Polygon, MultiPolygon, Position } from "geojson";
import { validarCoordenada } from "./gis";
import type { Estado, Camada } from "./projeto";
import { avaliarArvore } from "./inventario";

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

// Turf-based area and APP buffer helpers (pure, offline).
import {
  area as turfArea,
  buffer as turfBuffer,
  union as turfUnion,
  featureCollection as turfFc,
} from "@turf/turf";
import type { Feature } from "geojson";

export function areaHa(fc: FeatureCollection) {
  return (
    fc.features.reduce(
      (n, f) =>
        n +
        (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon" ? turfArea(f) : 0),
      0,
    ) / 10000
  );
}
export const DISTANCIAS_APP = [30, 50, 100] as const;
/** Buffers every hydrography feature (lines, springs, polygons) of the project into one APP polygon layer. */
export function bufferApp(s: Estado, projetoId: string, metros: number): FeatureCollection {
  if (!Number.isFinite(metros) || metros <= 0) throw new Error("Distância de APP inválida.");
  const feicoes = s.camadas
    .filter((c) => c.projetoId === projetoId && c.tipo === "Hidrografia")
    .flatMap((c) => c.geojson.features);
  if (!feicoes.length) throw new Error("Cadastre ou desenhe a hidrografia/nascentes primeiro.");
  const polis = feicoes
    .map((f) => turfBuffer(f, metros, { units: "meters" }))
    .filter((f): f is Feature<Polygon | MultiPolygon> => !!f && !!f.geometry);
  const unido = polis.length > 1 ? turfUnion(turfFc(polis)) : polis[0];
  if (!unido) throw new Error("Não foi possível gerar a APP.");
  return validarCamada({
    type: "FeatureCollection",
    features: [{ ...unido, properties: { origem: "buffer-hidrografia", metros } }],
  });
}
export const ehAppAutomatica = (c: Camada) =>
  c.tipo === "APP" && c.geojson.features.some((f) => f.properties?.["origem"] === "buffer-hidrografia");

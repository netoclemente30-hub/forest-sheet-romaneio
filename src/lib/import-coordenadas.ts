import { campoInventario, numeroInventario } from "./import-base";
import type { Arvore } from "./data";
import proj4 from "proj4";

export type SistemaCoordenadas = { tipo: "decimal" } | { tipo: "utm"; fuso: number; hemisferio: "sul" | "norte"; datum: "SIRGAS2000" | "WGS84" | "SAD69" };
export function precisaConversaoUtm(rows: unknown[][]) {
  const header = rows.find((r) => ["numero", "latitude", "longitude"].every((c) => r.some((v) => campoInventario(v) === c)));
  if (!header) return false;
  const lat = header.findIndex((v) => campoInventario(v) === "latitude");
  const lng = header.findIndex((v) => campoInventario(v) === "longitude");
  return rows.some((r) => Math.abs(numeroInventario(r[lat]) ?? 0) > 90 || Math.abs(numeroInventario(r[lng]) ?? 0) > 180);
}

export function converterCoordenadas(x: number, y: number, sistema: SistemaCoordenadas) {
  if (sistema.tipo === "decimal") return { latitude: x, longitude: y };
  if (!Number.isInteger(sistema.fuso) || sistema.fuso < 1 || sistema.fuso > 60) throw new Error("Informe o fuso UTM de 1 a 60.");
  if (x < 100000 || x > 900000 || y < 0 || y > 10000000) throw new Error("Coordenadas UTM inválidas; Latitude deve conter Este (X) e Longitude, Norte (Y), em metros.");
  const datum = sistema.datum === "SIRGAS2000" ? "+ellps=GRS80 +towgs84=0,0,0" : sistema.datum === "SAD69" ? "+ellps=aust_SA +towgs84=-67.35,3.88,-38.22" : "+datum=WGS84";
  const crs = `+proj=utm +zone=${sistema.fuso} ${sistema.hemisferio === "sul" ? "+south" : ""} ${datum} +units=m +no_defs`;
  const [longitude, latitude] = proj4(crs, "EPSG:4326", [x, y]);
  if (latitude === undefined || longitude === undefined || !Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Não foi possível converter as coordenadas.");
  return { latitude, longitude };
}

export type CoordenadaImportada = { arvore: Arvore; latitude: number; longitude: number; linha: number };
export function analisarCoordenadas(rows: unknown[][], arvores: Arvore[], empresa: string, autex: string, sistema: SistemaCoordenadas = { tipo: "decimal" }) {
  const atualizacoes: CoordenadaImportada[] = [];
  const erros: string[] = [];
  const headerIndex = rows.findIndex((r) => ["numero", "latitude", "longitude"].every((campo) => r.some((v) => campoInventario(v) === campo)));
  if (headerIndex < 0) return { atualizacoes, erros: ["A planilha precisa das colunas Número, Latitude e Longitude."] };
  const header = rows[headerIndex] ?? [];
  const coluna = (campo: string) => header.findIndex((v) => campoInventario(v) === campo);
  const numeros = new Map<number, Arvore[]>();
  for (const a of arvores) if (a.empresa_id === empresa && a.autex === autex) numeros.set(a.numero, [...(numeros.get(a.numero) ?? []), a]);
  const vistos = new Set<number>();
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.every((v) => String(v ?? "").trim() === "")) continue;
    const numero = numeroInventario(row[coluna("numero")]);
    const x = numeroInventario(row[coluna("latitude")]);
    const y = numeroInventario(row[coluna("longitude")]);
    if (String(row[coluna("numero")] ?? "").trim() === "" && x === null && y === null) continue;
    const autexLinha = String(row[coluna("autex")] ?? "").trim();
    const erro = (motivo: string) => erros.push(`Linha ${i + 1}: ${motivo}`);
    if (numero === null || !Number.isSafeInteger(numero) || numero <= 0) { erro("número de árvore inválido."); continue; }
    if (vistos.has(numero)) { erro(`árvore ${numero} repetida.`); continue; }
    vistos.add(numero);
    if (autexLinha && autexLinha !== autex) { erro(`AUTEX diferente do manejo selecionado (${autex}).`); continue; }
    if (x === null || y === null) { erro("Latitude/Longitude não preenchidas ou inválidas."); continue; }
    let latitude: number, longitude: number;
    try { ({ latitude, longitude } = converterCoordenadas(x, y, sistema)); }
    catch (e) { erro(e instanceof Error ? e.message : "Coordenadas inválidas."); continue; }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) { erro("Latitude/Longitude inválidas; selecione UTM se os valores estiverem em metros."); continue; }
    const candidatos = numeros.get(numero) ?? [];
    const arvore = candidatos[0];
    if (!arvore || candidatos.length !== 1) { erro(`árvore ${numero} não encontrada de forma única neste manejo.`); continue; }
    atualizacoes.push({ arvore, latitude, longitude, linha: i + 1 });
  }
  if (!atualizacoes.length && !erros.length) erros.push("Nenhuma coordenada preenchida na planilha.");
  return { atualizacoes, erros };
}

export function dadosCoordenadas(latitude: number, longitude: number, agora: string) {
  return { latitude, longitude, gps_precisao: null, localizado_em: agora };
}
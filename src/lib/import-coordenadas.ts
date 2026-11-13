import { campoInventario, numeroInventario } from "./import-base";
import type { Arvore } from "./data";

export type CoordenadaImportada = { arvore: Arvore; latitude: number; longitude: number; linha: number };
export function analisarCoordenadas(rows: unknown[][], arvores: Arvore[], empresa: string, autex: string) {
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
    const latitude = numeroInventario(row[coluna("latitude")]);
    const longitude = numeroInventario(row[coluna("longitude")]);
    const autexLinha = String(row[coluna("autex")] ?? "").trim();
    const erro = (motivo: string) => erros.push(`Linha ${i + 1}: ${motivo}`);
    if (numero === null || !Number.isSafeInteger(numero) || numero <= 0) { erro("número de árvore inválido."); continue; }
    if (vistos.has(numero)) { erro(`árvore ${numero} repetida.`); continue; }
    vistos.add(numero);
    if (autexLinha && autexLinha !== autex) { erro(`AUTEX diferente do manejo selecionado (${autex}).`); continue; }
    if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) { erro("Latitude/Longitude inválidas; use graus decimais WGS84."); continue; }
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
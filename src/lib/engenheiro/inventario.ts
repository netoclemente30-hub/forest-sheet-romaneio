import { z } from "zod";
import { dapPorCap } from "./coleta";
import { dentro, type Coordenada } from "./gis";
import type { Polygon, MultiPolygon } from "geojson";

const positivo = z.number().finite().positive();
export const especieSchema = z
  .object({
    codigo: z.string().trim().min(1),
    nomePopular: z.string().trim().min(1),
    nomeCientifico: z.string().trim().min(1),
    dmcCm: positivo,
    fatorForma: positivo,
    // Safe parameterized power equation: a * DAP(cm)^b * H(m)^c. Never eval code.
    equacaoVolume: z
      .object({ a: positivo, b: z.number().finite(), c: z.number().finite() })
      .optional(),
    statusLegal: z.enum(["COMERCIAL", "PROIBIDA_IMUNE", "RARA"]),
  })
  .strict();
export type Especie = z.infer<typeof especieSchema>;
export const censoSchema = z
  .object({
    ut: z.string().trim().min(1),
    faixaPicada: z.string().trim().min(1),
    numeroArvore: z.string().trim().min(1),
    especieId: z.string().trim().min(1),
    dapCm: positivo.optional(),
    capCm: positivo.optional(),
    alturaComercialM: positivo,
    qualidadeFuste: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    cipos: z.boolean(),
    ocoAparente: z.boolean(),
    destinacao: z.enum(["CORTE", "PORTA_SEMENTE", "REMANESCENTE", "PROIBIDA_APP"]),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })
  .strict()
  .superRefine((a, ctx) => {
    if (!a.dapCm && !a.capCm) ctx.addIssue({ code: "custom", message: "Informe CAP ou DAP." });
    if (a.dapCm && a.capCm && Math.abs(a.dapCm - dapPorCap(a.capCm)) > 0.01)
      ctx.addIssue({ code: "custom", message: "CAP e DAP incompatíveis." });
  });
export type Censo = z.infer<typeof censoSchema>;
export function medidas(dapCm: number, alturaM: number, especie: Especie) {
  positivo.parse(dapCm);
  positivo.parse(alturaM);
  especieSchema.parse(especie);
  const areaBasal = (Math.PI * (dapCm / 100) ** 2) / 4;
  const eq = especie.equacaoVolume;
  const volume = eq
    ? eq.a * dapCm ** eq.b * alturaM ** eq.c
    : areaBasal * alturaM * especie.fatorForma;
  if (!Number.isFinite(volume) || volume <= 0) throw new Error("Equação produziu volume inválido.");
  return { dapCm, areaBasal, volume };
}
export function chaveArvore(a: Pick<Censo, "ut" | "numeroArvore">) {
  const numero = a.numeroArvore
    .trim()
    .toUpperCase()
    .replace(/^0+(?=\d)/, "");
  return JSON.stringify([a.ut.trim(), numero]);
}
export function avaliarArvore(
  entrada: Censo,
  especie: Especie,
  app: (Polygon | MultiPolygon)[],
  ut: (Polygon | MultiPolygon)[],
) {
  const a = censoSchema.parse(entrada);
  especieSchema.parse(especie);
  if (a.especieId !== especie.codigo) throw new Error("Espécie incompatível.");
  const dapCm = a.dapCm ?? dapPorCap(a.capCm!);
  const alertas: string[] = [];
  let destinacao = a.destinacao;
  if (!ut.length) {
    alertas.push("Limite da UT não cadastrado");
    destinacao = "REMANESCENTE";
  } else if (!dentro(a as Coordenada, ut)) {
    alertas.push("Fora da UT");
    destinacao = "REMANESCENTE";
  }
  if (especie.statusLegal === "RARA") {
    alertas.push("Espécie rara: revisão técnica necessária");
    destinacao = "REMANESCENTE";
  }
  if (dapCm < especie.dmcCm) {
    alertas.push("Abaixo do DMC configurado");
    destinacao = "REMANESCENTE";
  }
  if (especie.statusLegal === "PROIBIDA_IMUNE") {
    alertas.push("Espécie proibida/imune");
    destinacao = "PROIBIDA_APP";
  }
  if (dentro(a, app)) {
    alertas.push("Árvore em APP (inclui borda)");
    destinacao = "PROIBIDA_APP";
  }
  return { ...a, destinacao, alertas, ...medidas(dapCm, a.alturaComercialM, especie) };
}

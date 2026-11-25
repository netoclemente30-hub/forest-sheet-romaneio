import { z } from "zod";

// Field measurements only: no harvesting decision or default volume equation.
export const arvoreColetada = z
  .object({
    numero: z.string().trim().min(1).max(60),
    especie: z.string().trim().min(1).max(160),
    dapCm: z.number().finite().positive(),
    alturaComercialM: z.number().finite().positive().optional(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
  })
  .strict()
  .refine((a) => (a.latitude === undefined) === (a.longitude === undefined), {
    message: "Informe latitude e longitude juntas, em WGS84.",
  });
export type ArvoreColetada = z.infer<typeof arvoreColetada>;

export const escopoColeta = z
  .object({
    usuarioId: z.string().trim().min(1),
    escritorioId: z.string().trim().min(1),
    projetoId: z.string().trim().min(1),
  })
  .strict();
export type EscopoColeta = z.infer<typeof escopoColeta>;

export function chaveEscopo(escopo: EscopoColeta): string {
  const e = escopoColeta.parse(escopo);
  return JSON.stringify([e.usuarioId, e.escritorioId, e.projetoId]);
}

export function dapPorCap(capCm: number): number {
  if (!Number.isFinite(capCm) || capCm <= 0)
    throw new Error("CAP deve ser positivo, em centímetros.");
  return capCm / Math.PI;
}

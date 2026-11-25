import { z } from "zod";
import type { FeatureCollection } from "geojson";
import { validarCamada } from "./camadas";
import { especieSchema, censoSchema, chaveArvore, type Especie, type Censo } from "./inventario";

export const projetoSchema = z.object({
  id: z.string().min(1),
  nome: z.string().trim().min(1),
  propriedadeId: z.string().min(1),
  tipo: z.enum(["PMFS", "POA"]),
  zona: z.number().int().min(1).max(60),
  hemisferio: z.enum(["S", "N"]),
  intensidadeMax: z.number().finite().positive(),
  percentualSementes: z.number().finite().min(0).max(100),
});
export type Projeto = z.infer<typeof projetoSchema>;
export type Camada = {
  id: string;
  projetoId: string;
  tipo: "Limite_UPA" | "UTs" | "Hidrografia" | "APP" | "Patios_Estradas";
  ut: string;
  geojson: FeatureCollection;
};
export type Estado = {
  revisao: number;
  clientes: { id: string; nome: string }[];
  propriedades: { id: string; clienteId: string; nome: string }[];
  projetos: Projeto[];
  uts: { id: string; projetoId: string; nome: string; areaHa: number }[];
  especies: (Especie & { projetoId: string })[];
  censo: (Censo & { projetoId: string })[];
  camadas: Camada[];
};
export const vazio = (): Estado => ({
  revisao: 0,
  clientes: [],
  propriedades: [],
  projetos: [],
  uts: [],
  especies: [],
  censo: [],
  camadas: [],
});
export function validarEstado(s: Estado) {
  if (!Number.isSafeInteger(s.revisao) || s.revisao < 0) throw new Error("Revisão local inválida.");
  const ids = new Set<string>();
  for (const c of [...s.clientes, ...s.propriedades, ...s.projetos, ...s.uts]) {
    if (!c.id || !c.nome.trim() || ids.has(c.id))
      throw new Error("Cadastro sem identidade ou duplicado.");
    ids.add(c.id);
  }
  for (const p of s.propriedades)
    if (!s.clientes.some((c) => c.id === p.clienteId)) throw new Error("Cliente não encontrado.");
  for (const p of s.projetos) {
    projetoSchema.parse(p);
    if (!s.propriedades.some((i) => i.id === p.propriedadeId))
      throw new Error("Propriedade não encontrada.");
  }
  const projetoExiste = (id: string) => {
    if (!s.projetos.some((p) => p.id === id)) throw new Error("Projeto não encontrado.");
  };
  for (const u of s.uts) {
    projetoExiste(u.projetoId);
    if (!Number.isFinite(u.areaHa) || u.areaHa <= 0)
      throw new Error("Área da UT deve ser positiva.");
  }
  const especies = new Set<string>();
  for (const { projetoId, ...e } of s.especies) {
    projetoExiste(projetoId);
    especieSchema.parse(e);
    const k = JSON.stringify([projetoId, e.codigo]);
    if (especies.has(k)) throw new Error("Código de espécie duplicado.");
    especies.add(k);
  }
  const arvores = new Set<string>();
  for (const { projetoId, ...a } of s.censo) {
    projetoExiste(projetoId);
    censoSchema.parse(a);
    if (!s.uts.some((u) => u.id === a.ut && u.projetoId === projetoId))
      throw new Error("UT não pertence ao projeto.");
    if (!especies.has(JSON.stringify([projetoId, a.especieId])))
      throw new Error("Espécie não cadastrada.");
    const k = JSON.stringify([projetoId, chaveArvore(a)]);
    if (arvores.has(k)) throw new Error("Placa duplicada na mesma UT.");
    arvores.add(k);
  }
  for (const c of s.camadas) {
    projetoExiste(c.projetoId);
    if (!c.id || ids.has(c.id)) throw new Error("Camada sem identidade ou duplicada.");
    ids.add(c.id);
    if (!["Limite_UPA", "UTs", "Hidrografia", "APP", "Patios_Estradas"].includes(c.tipo))
      throw new Error("Tipo de camada inválido.");
    validarCamada(c.geojson);
    if (
      ["APP", "UTs", "Limite_UPA"].includes(c.tipo) &&
      c.geojson.features.some((f) => !["Polygon", "MultiPolygon"].includes(f.geometry.type))
    )
      throw new Error("Camada exige polígonos.");
    if (c.tipo === "UTs" && !s.uts.some((u) => u.id === c.ut && u.projetoId === c.projetoId))
      throw new Error("Associe a camada à UT do projeto.");
  }
}

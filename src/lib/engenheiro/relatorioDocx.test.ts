import { describe, it, expect } from "vitest";
import { dadosRelatorio } from "./relatorioDocx";
import { areaHa, bufferApp } from "./camadas";
import { paraGpx, lerGpx } from "./gps";
import { vazio, type Estado } from "./projeto";

const quad = (d: number) => ({
  type: "FeatureCollection" as const,
  features: [{ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const,
    coordinates: [[[-63, -10], [-63 + d, -10], [-63 + d, -10 + d], [-63, -10 + d], [-63, -10]]] } }],
});
function estado(): Estado {
  const s = vazio();
  s.clientes.push({ id: "c", nome: "José" });
  s.propriedades.push({ id: "pr", clienteId: "c", nome: "Faz" });
  s.projetos.push({ id: "p", nome: "P1", propriedadeId: "pr", tipo: "PMFS", zona: 20, hemisferio: "S", intensidadeMax: 30, percentualSementes: 10 });
  s.uts.push({ id: "u", projetoId: "p", nome: "UT1", areaHa: 100 });
  s.especies.push({ projetoId: "p", codigo: "IPE", nomePopular: "Ipê", nomeCientifico: "Handroanthus", dmcCm: 50, fatorForma: 0.7, statusLegal: "COMERCIAL" });
  s.camadas.push({ id: "ut", projetoId: "p", tipo: "UTs", ut: "u", geojson: quad(0.01) });
  const base = { ut: "u", faixaPicada: "1", especieId: "IPE", alturaComercialM: 10, qualidadeFuste: 1 as const, cipos: false, ocoAparente: false, destinacao: "CORTE" as const, latitude: -9.995, projetoId: "p" };
  s.censo.push({ ...base, numeroArvore: "1", dapCm: 60, longitude: -62.995 });
  s.censo.push({ ...base, numeroArvore: "2", dapCm: 40, longitude: -62.996 });
  return s;
}
describe("engenheiro: relatório, área, APP e GPX", () => {
  it("separa corte e remanescente abaixo do DMC por espécie", () => {
    const d = dadosRelatorio(estado(), "p", { car: "RO-1", responsavel: "", registro: "" });
    expect(d.especies[0]!.corte.n).toBe(1);
    expect(d.especies[0]!.remanescente.n).toBe(1);
    expect(d.areaManejoHa).toBe(100);
  });
  it("calcula área em hectares", () => {
    expect(areaHa(quad(0.01))).toBeGreaterThan(120);
    expect(areaHa(quad(0.01))).toBeLessThan(125);
  });
  it("buffer de APP de 30 m sobre nascente coloca árvore próxima em APP", () => {
    const s = estado();
    s.camadas.push({ id: "h", projetoId: "p", tipo: "Hidrografia", ut: "", geojson: { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [-62.995, -9.9952] } }] } });
    const app = bufferApp(s, "p", 30);
    s.camadas.push({ id: "a", projetoId: "p", tipo: "APP", ut: "", geojson: app });
    const d = dadosRelatorio(s, "p", { car: "", responsavel: "", registro: "" });
    expect(d.especies[0]!.protegidas.n).toBe(1);
  });
  it("exporta e reimporta GPX", () => {
    const g = paraGpx([{ latitude: -10, longitude: -63, tempo: "2026-01-01T00:00:00Z" }, { latitude: -10.001, longitude: -63.001, tempo: "2026-01-01T00:01:00Z" }]);
    expect(lerGpx(g)).toHaveLength(2);
  });
});

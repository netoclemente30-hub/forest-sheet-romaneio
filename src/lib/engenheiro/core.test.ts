import { describe, it, expect } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import type { Polygon } from "geojson";
import { paraUTM, deUTM, dentro } from "./gis";
import { avaliarArvore, medidas, type Censo, type Especie } from "./inventario";
import { vazio, validarEstado, type Estado } from "./projeto";
import { lerEstado, salvarEstado, abrirBanco, BANCO_ENGENHEIRO } from "./banco";
import { previaTabela, linhasIF100, csvIF100, csvSeguro } from "./intercambio";
import { importarCamada, avaliarCenso } from "./camadas";
import { sugerirSementes, resumo } from "./triagem";

const e: Especie = {
  codigo: "E1",
  nomePopular: "Teste",
  nomeCientifico: "Species exemplaris",
  dmcCm: 50,
  fatorForma: 0.7,
  statusLegal: "COMERCIAL",
};
const a: Censo = {
  ut: "ut1",
  numeroArvore: "1",
  faixaPicada: "1",
  especieId: "E1",
  dapCm: 60,
  alturaComercialM: 20,
  qualidadeFuste: 1,
  cipos: false,
  ocoAparente: false,
  destinacao: "CORTE",
  latitude: -10,
  longitude: -63,
};
const pol: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [-64, -11],
      [-62, -11],
      [-62, -9],
      [-64, -9],
      [-64, -11],
    ],
  ],
};
function estado(): Estado {
  return {
    ...vazio(),
    clientes: [{ id: "c", nome: "Cliente" }],
    propriedades: [{ id: "f", clienteId: "c", nome: "Fazenda" }],
    projetos: [
      {
        id: "p",
        propriedadeId: "f",
        nome: "Projeto",
        tipo: "POA",
        zona: 20,
        hemisferio: "S",
        intensidadeMax: 20,
        percentualSementes: 50,
      },
    ],
    uts: [{ id: "ut1", projetoId: "p", nome: "UT1", areaHa: 100 }],
    especies: [{ ...e, projetoId: "p" }],
    censo: [{ ...a, projetoId: "p" }],
    camadas: [
      {
        id: "layer",
        projetoId: "p",
        ut: "ut1",
        tipo: "UTs",
        geojson: {
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: pol }],
        },
      },
    ],
  };
}

describe("GIS e triagem local", () => {
  it("projeta no meridiano central 20S e retorna a coordenada original", () => {
    const u = paraUTM(a, 20, "S");
    expect(u.x).toBeCloseTo(500000, 4);
    expect(u.y).toBeCloseTo(8894587.51, 1);
    const c = deUTM(u.x, u.y, 20, "S");
    expect(c.latitude).toBeCloseTo(-10, 8);
    expect(c.longitude).toBeCloseTo(-63, 8);
    expect(() => deUTM(NaN, 1, 20, "S")).toThrow();
    expect(() => paraUTM(a, 0, "S")).toThrow();
    expect(() => paraUTM(a, 20, "N")).toThrow();
  });
  it("calcula G e volume por fator e por equação sem executar texto", () => {
    expect(medidas(60, 20, e).areaBasal).toBeCloseTo(Math.PI * 0.09, 10);
    expect(medidas(60, 20, e).volume).toBeCloseTo(Math.PI * 0.09 * 14, 10);
    expect(medidas(60, 20, { ...e, equacaoVolume: { a: 0.001, b: 2, c: 1 } }).volume).toBe(72);
    expect(() => medidas(60, 20, { ...e, equacaoVolume: "alert(1)" as never })).toThrow();
    expect(() => medidas(0, 20, e)).toThrow();
  });
  it("prioriza APP/proibição e bloqueia DMC, UT ausente e fora da UT", () => {
    expect(avaliarArvore(a, e, [], [pol]).destinacao).toBe("CORTE");
    expect(avaliarArvore({ ...a, dapCm: 49 }, e, [], [pol]).destinacao).toBe("REMANESCENTE");
    expect(avaliarArvore(a, { ...e, statusLegal: "PROIBIDA_IMUNE" }, [], [pol]).destinacao).toBe(
      "PROIBIDA_APP",
    );
    expect(avaliarArvore(a, e, [pol], [pol]).alertas).toContain("Árvore em APP (inclui borda)");
    expect(avaliarArvore(a, e, [], []).destinacao).toBe("REMANESCENTE");
    expect(avaliarArvore({ ...a, longitude: -60 }, e, [], [pol]).destinacao).toBe("REMANESCENTE");
  });
  it("inclui bordas de APP e respeita buracos", () => {
    const hole: Polygon = {
      ...pol,
      coordinates: [
        ...pol.coordinates,
        [
          [-63.5, -10.5],
          [-63.5, -9.5],
          [-62.5, -9.5],
          [-62.5, -10.5],
          [-63.5, -10.5],
        ],
      ],
    };
    expect(dentro(a, [hole])).toBe(false);
    expect(dentro({ latitude: -10, longitude: -64 }, [pol])).toBe(true);
  });
  it("rejeita duplicidade normalizada dentro da UT e referência a outro projeto", () => {
    const s = estado();
    s.censo.push({ ...a, numeroArvore: "001", projetoId: "p" });
    expect(() => validarEstado(s)).toThrow("Placa duplicada");
    s.censo = [{ ...a, ut: "inexistente", projetoId: "p" }];
    expect(() => validarEstado(s)).toThrow("UT não pertence");
  });
  it("seleciona matrizes dispersas e exclui fuste inadequado", () => {
    const s = estado();
    s.censo = [
      { ...a, projetoId: "p", dapCm: 80 },
      { ...a, projetoId: "p", numeroArvore: "2", longitude: -63.01 },
      { ...a, projetoId: "p", numeroArvore: "3", longitude: -62.5 },
      { ...a, projetoId: "p", numeroArvore: "4", qualidadeFuste: 2 },
    ];
    expect([...sugerirSementes(s, "p").selecionadas]).toEqual(['["ut1","1"]', '["ut1","3"]']);
    expect(resumo(s, "p")[0]?.total).toBe(4);
  });
  it("importa KML e rejeita CRS e anel aberto", () => {
    const fc = importarCamada(
      '<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><Point><coordinates>-63,-10,0</coordinates></Point></Placemark></kml>',
      "a.kml",
    );
    expect(fc.features[0]?.geometry.type).toBe("Point");
    expect(() => importarCamada(JSON.stringify({ ...fc, crs: { name: "UTM" } }), "a.json")).toThrow(
      "CRS",
    );
    const s = estado();
    const g = s.camadas[0]!.geojson;
    g.features[0]!.geometry = {
      type: "Polygon",
      coordinates: [
        [
          [-63, -10],
          [-62, -10],
          [-62, -9],
          [-63, -9],
        ],
      ],
    };
    expect(() => validarEstado(s)).toThrow("Anel não fechado");
  });
});
describe("persistência transacional e intercâmbio", () => {
  it("persiste bloqueio espacial, reabre e rejeita sobrescrita entre abas", async () => {
    const f = new IDBFactory();
    const s = estado();
    s.camadas.push({ ...s.camadas[0]!, id: "app", tipo: "APP" });
    const salvo = await salvarEstado(s, f);
    expect(salvo.censo[0]?.destinacao).toBe("PROIBIDA_APP");
    expect(await lerEstado(f)).toEqual(salvo);
    await expect(salvarEstado(s, f)).rejects.toThrow("Outra aba");
    expect(avaliarCenso(await lerEstado(f), "p")[0]?.alertas.length).toBeGreaterThan(0);
  });
  it("upgrade v1 preserva os rascunhos sem exclusão de store", async () => {
    const f = new IDBFactory();
    await new Promise<void>((resolve, reject) => {
      const r = f.open(BANCO_ENGENHEIRO, 1);
      r.onupgradeneeded = () =>
        r.result
          .createObjectStore("arvores", { keyPath: "chave" })
          .put({ chave: "legado", valor: 123 });
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        r.result.close();
        resolve();
      };
    });
    const db = await abrirBanco(f);
    expect([...db.objectStoreNames]).toEqual(["arvores", "core"]);
    const val = await new Promise<unknown>((resolve) => {
      const r = db.transaction("arvores").objectStore("arvores").get("legado");
      r.onsuccess = () => resolve(r.result);
    });
    expect(val).toEqual({ chave: "legado", valor: 123 });
    db.close();
  });
  it("prévia converte UTM e lista erros sem gravar", () => {
    const s = estado();
    const { latitude: _, longitude: __, ...rest } = a;
    const u = paraUTM(a, 20, "S");
    const pre = previaTabela(
      JSON.stringify([
        { ...rest, x: u.x, y: u.y },
        { ...rest, x: "", y: "" },
      ]),
      "censo",
      s.projetos[0]!,
    );
    expect(pre.dados).toHaveLength(1);
    expect(pre.erros).toHaveLength(1);
    expect(pre.dados[0]?.["latitude"]).toBeCloseTo(-10, 8);
    expect(s.revisao).toBe(0);
  });
  it("exporta 15 colunas, medidas em metros, acentos Latin1 e neutraliza fórmulas", () => {
    const s = estado();
    const linhas = linhasIF100(s, s.projetos[0]!, "UPA1", "Tora (m³)", {
      CORTE: "A explorar",
      PORTA_SEMENTE: "Porta semente",
      REMANESCENTE: "Remanescente",
      PROIBIDA_APP: "Outras",
    });
    expect(linhas.every((l) => l.length === 15)).toBe(true);
    expect(linhas[1]?.[7]).toBe(0.6);
    expect(linhas[1]?.[6]).toBe(1.885);
    expect(csvIF100(linhas)).toContain(250);
    expect(csvSeguro([["=1+1", -10]])).toBe('"\'=1+1";"-10"');
    expect(() => csvIF100([["🌲"]])).toThrow("ISO-8859-1");
  });
});

import { describe, expect, it } from "vitest";
import { ajustarControle, aplicarMatriz, arvoresProximas, inverterMatriz, lerGeoReferencia } from "./geopdf";
import { PDFDocument, PDFName } from "pdf-lib";

describe("GeoPDF e árvores próximas", () => {
  async function globalMapper(datum = "NAR", deslocamento = 0) {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    const lgi = doc.context.register(doc.context.obj({
      Type: "LGIDict", Version: "2.1",
      CTM: ["2.713901054248", "0.0", "0.0", "2.713901054248", "419065.266477928089", "9043718.886557903141"],
      Projection: { Type: "Projection", ProjectionType: "UT", Datum: datum, Hemisphere: "S", Zone: "20" },
      Registration: [["0", "0", String(419065.266477928089 + deslocamento), "9043718.886557903141"], ["612", "792", "420726.173923127644", "9045868.296192867681"]],
      Neatline: ["54", "738", "559", "738", "559", "54", "54", "54"],
    }));
    page.node.set(PDFName.of("LGIDict"), doc.context.obj([lgi]));
    return doc.save();
  }
  it("lê o formato LGIDict do AVZ com números em texto e UTM 20 sul NAD83", async () => {
    const geo = await lerGeoReferencia(await globalMapper());
    expect(geo.pagina).toBe(1);
    expect(geo.bbox).toEqual([54, 54, 559, 738]);
    expect(geo.crs).toContain("+zone=20 +south +datum=NAD83");
    const mundo = aplicarMatriz(geo.matriz, 612, 792);
    expect(mundo[0]).toBeCloseTo(420726.173923127644, 5);
    expect(mundo[1]).toBeCloseTo(9045868.296192867681, 5);
    const proj4 = (await import("proj4")).default;
    const gps = proj4(geo.crs, "EPSG:4326", mundo);
    expect(gps[0]).toBeGreaterThan(-64);
    expect(gps[0]).toBeLessThan(-63);
    expect(gps[1]).toBeGreaterThan(-9);
    expect(gps[1]).toBeLessThan(-8);
  });
  it("recusa datum LGIDict desconhecido sem inventar a posição", async () => {
    await expect(lerGeoReferencia(await globalMapper("UNKNOWN"))).rejects.toThrow("não reconhecido");
  });
  it("confere os registros LGIDict contra a transformação e recusa diferença maior que 3 metros", async () => {
    await expect(lerGeoReferencia(await globalMapper("NAR", 4))).rejects.toThrow("inconsistente");
  });
  it("lê controles indiretos do GeoPDF SIRGAS 2000 e recusa PDF comum", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([3370, 2384]);
    await expect(lerGeoReferencia(await doc.save())).rejects.toThrow("não contém georreferenciamento");
    const gcs = doc.context.register(doc.context.obj({ Type: "PROJCS", EPSG: 31980 }));
    const measure = doc.context.register(doc.context.obj({ Type: "Measure", Subtype: "GEO", GCS: gcs, LPTS: [0, 1, 0, 0, 1, 0, 1, 1], GPTS: [-9.01579402, -64.3634181, -9.03860825, -64.3635038, -9.03872741, -64.3310590, -9.01591288, -64.3309754] }));
    const vp = doc.context.register(doc.context.obj({ Type: "Viewport", BBox: [0, 0, 3370.08, 2383.92], Measure: measure }));
    page.node.set(PDFName.of("VP"), doc.context.obj([vp]));
    const geo = await lerGeoReferencia(await doc.save());
    expect(geo.pagina).toBe(1);
    expect(aplicarMatriz(geo.matriz, 0, 0)[0]).toBeCloseTo(350134.246, 1);
    expect(aplicarMatriz(geo.matriz, 0, 0)[1]).toBeCloseTo(9000599.214, 1);
  });
  it("alinha e inverte os controles do mapa com orientação PDF", () => {
    const m = ajustarControle([0, 1, 0, 0, 1, 0, 1, 1], [350000, 9003000, 350000, 9000000, 354000, 9000000, 354000, 9003000]);
    expect(aplicarMatriz(m, .5, .5)).toEqual([352000, 9001500]);
    expect(aplicarMatriz(inverterMatriz(m), 352000, 9001500)).toEqual([.5, .5]);
  });
  it("recusa controles inconsistentes em vez de inventar localização", () => {
    expect(() => ajustarControle([0, 1, 0, 0, 1, 0, 1, 1], [0, 100, 0, 0, 100, 0, 110, 100])).toThrow("inconsistente");
  });
  it("aproximação da árvore 349 sugere seleção sem alterar abatimento", () => {
    const arvore = { id: "349", numero: 349, latitude: -9, longitude: -63, abatida_em: null };
    expect(arvoresProximas([arvore], { lat: -9.00001, lng: -63, precisao: 5 }, 50)[0]?.arvore.numero).toBe(349);
    expect(arvore.abatida_em).toBeNull();
    expect(arvoresProximas([arvore], { lat: -9.01, lng: -63 }, 50)).toEqual([]);
  });
  it("não sugere árvores abatidas, sem localização ou GPS impreciso", () => {
    const a = { id: "349", numero: 349, latitude: -9, longitude: -63, abatida_em: null };
    expect(arvoresProximas([{ ...a, abatida_em: "2026-11-09" }, { ...a, latitude: null }], { lat: -9, lng: -63 }, 50)).toEqual([]);
    expect(arvoresProximas([a], { lat: -9, lng: -63, precisao: 101 }, 50)).toEqual([]);
  });
});
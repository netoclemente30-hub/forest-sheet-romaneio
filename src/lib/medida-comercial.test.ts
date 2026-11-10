import { describe, expect, it } from "vitest";
import { comprimentoComercial, medidaComercial, totaisComerciais } from "./medida-comercial";
import { volumeTora } from "./volume";

describe("medida comercial", () => {
  it("usa 52×54 cm e 6,5 m no exemplo 56×58 no pé, 52×54 no topo e 6,6 m", () => {
    const resultado = medidaComercial({ d_pe1: 56, d_pe2: 58, d_topo1: 52, d_topo2: 54, comprimento: 6.6 });
    expect(resultado).toMatchObject({ d1: 52, d2: 54, comprimento: 6.5, ponta: "topo" });
    expect(resultado?.volume).toBe(volumeTora({ d_topo1: 52, d_topo2: 54, d_pe1: 52, d_pe2: 54, comprimento: 6.5 }));
  });

  it.each([[6.9, 6.5], [6.6, 6.5], [6.1, 6], [6.5, 6.5], [6, 6], [0.9, 0.5]])("arredonda %s m para baixo: %s m", (fisico, comercial) => {
    expect(comprimentoComercial(fisico)).toBe(comercial);
  });

  it("escolhe o pé quando ele é a ponta mais fina", () => {
    expect(medidaComercial({ d_topo1: 60, d_topo2: 62, d_pe1: 48, d_pe2: 50, comprimento: 5.8 })).toMatchObject({ d1: 48, d2: 50, comprimento: 5.5, ponta: "pe" });
  });

  it("não inventa medida comercial quando faltam diâmetros ou comprimento", () => {
    expect(medidaComercial({ d_topo1: 52, d_topo2: 54, d_pe1: null, d_pe2: 58, comprimento: 6.6 })).toBeNull();
    expect(medidaComercial({ d_topo1: 52, d_topo2: 54, d_pe1: 56, d_pe2: 58, comprimento: null })).toBeNull();
  });

  it("compara os totais comercial e físico sem alterar o volume físico", () => {
    const tora = { d_pe1: 56, d_pe2: 58, d_topo1: 52, d_topo2: 54, comprimento: 6.6, volume: 2 };
    const totais = totaisComerciais([tora]);
    expect(totais.fisico).toBe(2);
    expect(totais.comercial).toBe(medidaComercial(tora)?.volume);
    expect(totais.diferenca).toBeCloseTo(totais.comercial - 2, 10);
    expect(tora.volume).toBe(2);
  });
});

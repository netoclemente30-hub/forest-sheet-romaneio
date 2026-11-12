import { describe, expect, it } from "vitest";
import { aproveitamento, rendimentoDesdobro, tabelaEstoque } from "./relatorios-gerais";
import type { Tora } from "./data";
import type { PacoteSerrado } from "./madeira-serrada";
import { volumeTora, fmtM3 } from "./volume";

const tora = (especie: string, volume: number, serrada_em: string | null) => ({ especie, volume, serrada_em, origem: "serraria" }) as unknown as Tora;
const pacote = (data: string, especie: string, volume_m3: number) => ({ data, carga_id: null, itens: [{ especie, volume_m3, total_pecas: 10 }] }) as unknown as PacoteSerrado;

describe("rendimento do desdobro", () => {
  it("calcula serrada ÷ toras × 100", () => {
    expect(aproveitamento(2, 0.9)).toBe(45);
    expect(aproveitamento(0, 1)).toBeNull();
  });
  it("filtra por período e espécie", () => {
    const r = rendimentoDesdobro(
      [tora("Ipê", 2, "2026-11-05T10:00:00Z"), tora("Ipê", 5, "2026-10-01T10:00:00Z"), tora("Cumaru", 3, "2026-11-05T10:00:00Z")],
      [pacote("2026-11-06", "ipê", 1), pacote("2026-11-06", "Cumaru", 1.5)],
      { inicio: "2026-11-01", fim: "2026-11-30", especie: "Ipê" },
    );
    expect(r.total.volToras).toBe(2);
    expect(r.total.volSerrado).toBe(1);
    expect(r.total.rendimento).toBe(50);
  });
});

describe("estoque consolidado", () => {
  it("mostra volume físico e comercial por espécie", () => {
    const t = { especie: "Abiurana", volume: volumeTora({ d_topo1: 52, d_topo2: 54, d_pe1: 56, d_pe2: 58, comprimento: 6.6 }), d_topo1: 52, d_topo2: 54, d_pe1: 56, d_pe2: 58, comprimento: 6.6, origem: "serraria", serrada_em: null } as unknown as Tora;
    const [manejo, patio] = tabelaEstoque([t], [], [], "");
    expect(manejo.linhas).toEqual([]);
    expect(patio.cabecalho).toContain("Volume comercial (m³)");
    expect(patio.linhas[0][1]).toBe(1);
    expect(patio.linhas[0][2]).toBe(fmtM3(1.5701));
    expect(patio.linhas[0][3]).toBe(fmtM3(1.434));
    expect(patio.rodape?.[3]).toBe(fmtM3(1.434));
  });
});

import { describe, expect, it } from "vitest";
import { MANEJO, SERRARIA_ABAS, abaSerrariaDoBusca, emManejo, emSerraria } from "./nav";

describe("seções da navegação", () => {
  it("Conferir saldo é aba da Serraria, não do Manejo", () => {
    expect(SERRARIA_ABAS.map((a) => a.label)).toEqual([
      "Estoque / Pátio",
      "Toras Encaixadas",
      "Toras serradas",
      "Madeira serrada",
      "Conferir saldo",
    ]);
    expect(MANEJO.map((m) => m.label)).toEqual(["Base", "Toras de manejo", "Romaneio de toras", "Cortador / Mapa"]);
    expect(MANEJO.some((m) => m.label.toLowerCase().includes("saldo"))).toBe(false);
    expect(emManejo("/saldo")).toBe(false);
    expect(emSerraria("/saldo")).toBe(true);
    expect(emSerraria("/serraria")).toBe(true);
    expect(emManejo("/base")).toBe(true);
  });

  it("aceita só as abas known da Serraria na URL", () => {
    expect(abaSerrariaDoBusca("encaixadas")).toBe("encaixadas");
    expect(abaSerrariaDoBusca("saldo")).toBeUndefined();
    expect(abaSerrariaDoBusca("nada")).toBeUndefined();
  });
});

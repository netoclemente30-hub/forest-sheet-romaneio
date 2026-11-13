import { describe, expect, it } from "vitest";
import { ehRotaPublica } from "./nav";

describe("ehRotaPublica", () => {
  it("abre a página pública da tora sem login", () => {
    expect(ehRotaPublica("/t/8f14e45f-ceea-467a-9c8f-2f0f2b7a1c3d")).toBe(true);
  });

  it("abre a apresentação do app sem login", () => {
    expect(ehRotaPublica("/apresentacao")).toBe(true);
  });

  it("exige login no painel e nas telas de trabalho", () => {
    for (const p of ["/", "/base", "/toras", "/serraria", "/saldo", "/romaneio", "/relatorios", "/usuarios", "/registros"]) {
      expect(ehRotaPublica(p)).toBe(false);
    }
  });

  it("não libera caminho que só parece público", () => {
    expect(ehRotaPublica("/apresentacao-x")).toBe(false);
    expect(ehRotaPublica("/toras")).toBe(false);
    expect(ehRotaPublica("/t"></code>)).toBe(false);
  });
});

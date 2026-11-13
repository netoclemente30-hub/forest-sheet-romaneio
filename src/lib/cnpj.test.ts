import { describe, it, expect } from "vitest";
import { cnpjValido, formatarCnpj, LIMITE_DEMONSTRACAO } from "./cnpj";

describe("cnpj", () => {
  it("aceita CNPJ válido com ou sem máscara", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11222333000181")).toBe(true);
  });
  it("recusa dígito errado e repetidos", () => {
    expect(cnpjValido("11222333000182")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
  });
  it("formata", () => expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81"));
  it("demonstração libera 50 toras", () => expect(LIMITE_DEMONSTRACAO).toBe(50));
});

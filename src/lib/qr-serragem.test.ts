import { describe, expect, it } from "vitest";
import type { Tora } from "./data";
import { qrTora } from "./tora-qr";
import { resolverQrSerragem } from "./qr-serragem";

const tora = { empresa_id: "RJ", plaqueta: 50, arvore: 349, secao: "A", autex: "AUTEX-1", volume: 1.25 } as Tora;
describe("etiqueta na serragem", () => {
  it("abre a tora 349 da etiqueta usando os dados atuais, não as medidas impressas", () => {
    const atual = { ...tora, volume: 1.5 };
    expect(resolverQrSerragem(qrTora(tora), [atual], "RJ")).toBe(atual);
  });
  it("mantém a etiqueta antiga com somente a plaqueta", () => {
    expect(resolverQrSerragem("50", [tora], "RJ").arvore).toBe(349);
  });
  it("não abre tora de outra empresa com a mesma plaqueta", () => {
    expect(() => resolverQrSerragem("50", [tora], "Outra")).toThrow("não encontrada nesta empresa");
  });
  it("recusa uma etiqueta de identidade anterior", () => {
    expect(() => resolverQrSerragem(qrTora(tora), [{ ...tora, arvore: 350 }], "RJ")).toThrow("identidade atual");
  });
  it("recusa QR de romaneio", () => {
    expect(() => resolverQrSerragem('{"tipo":"romaneio","versao":1,"plaqueta":50}', [tora], "RJ")).toThrow("Etiqueta inválida");
  });
});
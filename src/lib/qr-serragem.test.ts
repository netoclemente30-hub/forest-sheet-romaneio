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
  it("não confunde duas empresas com a plaqueta 2 e UUID distintos", () => {
    const rj = { ...tora, plaqueta: 2, empresa_id: "rj", arvore: 3189,
      secao: "A", especie: "Angelim", publico_id: "4be6b922-b689-473c-bc6f-00a89de5cc69" };
    const madenorte = { ...tora, plaqueta: 2, empresa_id: "madenorte", arvore: 394,
      secao: "B", especie: "Abiurana", publico_id: "7c24b195-d5ad-4c40-ba53-ccf7f8bc05de" };
    expect(resolverQrSerragem(qrTora(madenorte), [rj, madenorte], "madenorte")).toBe(madenorte);
    expect(() => resolverQrSerragem(qrTora(rj), [rj, madenorte], "madenorte")).toThrow("outra empresa");
    const urlSemEmpresa = qrTora(rj).replace("&e=rj", "");
    expect(() => resolverQrSerragem(urlSemEmpresa, [rj, madenorte], "madenorte")).toThrow("outra tora ou empresa");
    expect(() => resolverQrSerragem(qrTora(madenorte), [rj, madenorte], "rj")).toThrow("outra empresa");
  });

  it("recusa QR de romaneio", () => {
    expect(() => resolverQrSerragem('{"tipo":"romaneio","versao":1,"plaqueta":50}', [tora], "RJ")).toThrow("Etiqueta inválida");
  });
  it("etiqueta com link público abre a tora no leitor interno e confere a identidade", () => {
    const pub = { ...tora, publico_id: "11111111-2222-3333-4444-555555555555" } as Tora;
    const raw = qrTora(pub);
    expect(raw).toBe("https://gestorflorestal.com.br/t/11111111-2222-3333-4444-555555555555?p=50&a=349&s=A&x=AUTEX-1&e=RJ");
    expect(resolverQrSerragem(raw, [pub], "RJ")).toBe(pub);
    expect(() => resolverQrSerragem(raw, [{ ...pub, arvore: 350 }], "RJ")).toThrow("identidade atual");
  });
});

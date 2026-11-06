import { afterEach, describe, expect, it, vi } from "vitest";
import { comCache } from "./cache";
import { idb } from "./db";

afterEach(() => vi.restoreAllMocks());

describe("consulta sem internet", () => {
  it("lê a base já salva sem aguardar uma tentativa de rede", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    vi.spyOn(idb, "get").mockResolvedValue({ dados: [{ numero: 5, nome_vulgar: "Mandioqueira" }] });
    const buscar = vi.fn();
    expect(await comCache("arvores", buscar)).toEqual([{ numero: 5, nome_vulgar: "Mandioqueira" }]);
    expect(buscar).not.toHaveBeenCalled();
  });
  it("não mostra uma base vazia como se tivesse carregado quando não há cache", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    vi.spyOn(idb, "get").mockResolvedValue(undefined);
    await expect(comCache("arvores", vi.fn())).rejects.toThrow("sem dados salvos");
  });
});
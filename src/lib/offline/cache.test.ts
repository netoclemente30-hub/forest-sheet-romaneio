import { afterEach, describe, expect, it, vi } from "vitest";
import { comCache } from "./cache";
import { idb } from "./db";

afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem("empresa_ativa"); });

it("resposta atrasada da RJ não grava toras no cache da empresa selecionada depois", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const put = vi.spyOn(idb, "put").mockResolvedValue(undefined);
  localStorage.setItem("empresa_ativa", "rj");
  let resolver: ((dados: { plaqueta: number }[]) => void) | undefined;
  const pendente = comCache("toras", () => new Promise<{ plaqueta: number }[]>((resolve) => { resolver = resolve; }));
  localStorage.setItem("empresa_ativa", "ricardo");
  resolver?.([{ plaqueta: 273 }]);
  await pendente;
  expect(put).toHaveBeenCalledWith("cache", expect.objectContaining({ dados: [{ plaqueta: 273 }] }), "rj:toras");
  expect(put).not.toHaveBeenCalledWith("cache", expect.anything(), "ricardo:toras");
});

describe("consulta sem internet", () => {
  it("lê a base já salva sem aguardar uma tentativa de rede", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    vi.spyOn(idb, "get").mockResolvedValue({ dados: [{ numero: 5, nome_vulgar: "Mandioqueira" }] });
    const buscar = vi.fn();
    expect(await comCache("arvores", buscar)).toEqual([{ numero: 5, nome_vulgar: "Mandioqueira" }]);
    expect(buscar).not.toHaveBeenCalled();
  });
  it("retorna uma lista vazia sem consultar a rede quando não há cache offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    vi.spyOn(idb, "get").mockResolvedValue(undefined);
    const buscar = vi.fn();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await comCache("arvores", buscar)).toEqual([]);
    expect(buscar).not.toHaveBeenCalled();
  });
  it("retorna uma lista vazia se o IndexedDB estiver indisponível offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    vi.spyOn(idb, "get").mockRejectedValue(new Error("IndexedDB indisponível"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await comCache("toras", vi.fn())).toEqual([]);
  });
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: vi.fn() } } }));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { informarConexao } from "./conexao";
import { comCache } from "./cache";
import { idb } from "./db";
import { supabase } from "@/integrations/supabase/client";

afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem("empresa_ativa"); });

// Cada gravação/leitura do IndexedDB identifica a sessão atual, também offline.
let idUsuario = "usuario-a";
beforeEach(() => {
  informarConexao(true);
  idUsuario = "usuario-a";
  vi.spyOn(supabase.auth, "getSession").mockImplementation(async () => ({
    data: { session: idUsuario ? { user: { id: idUsuario } } : null }, error: null,
  } as never));
});

it("resposta atrasada da RJ não grava toras no cache da empresa selecionada depois", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const put = vi.spyOn(idb, "put").mockResolvedValue(undefined);
  localStorage.setItem("empresa_ativa", "rj");
  let resolver: ((dados: { plaqueta: number }[]) => void) | undefined;
  const pendente = comCache("toras", () => new Promise<{ plaqueta: number }[]>((resolve) => { resolver = resolve; }));
  await vi.waitFor(() => expect(resolver).toBeTypeOf("function"));
  localStorage.setItem("empresa_ativa", "ricardo");
  resolver?.([{ plaqueta: 273 }]);
  await pendente;
  expect(put).toHaveBeenCalledWith("cache", expect.objectContaining({ dados: [{ plaqueta: 273 }] }), "usuario-a:rj:toras");
  expect(put).not.toHaveBeenCalledWith("cache", expect.anything(), "usuario-a:ricardo:toras");
});

it('resposta perdida de uma conta não é salva no cache da conta seguinte', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const put = vi.spyOn(idb, 'put').mockResolvedValue(undefined);
  let resolver: ((dados: { plaqueta: number }[]) => void) | undefined;
  const leitura = comCache('toras', () => new Promise<{ plaqueta: number }[]>(resolve => { resolver = resolve; }));
  await vi.waitFor(() => expect(resolver).toBeTypeOf('function'));
  idUsuario = 'usuario-b';
  resolver?.([{ plaqueta: 9 }]);
  expect(await leitura).toEqual([]);
  expect(put).toHaveBeenCalledWith('cache', expect.anything(), 'usuario-a:sem-vinculo:toras');
  expect(put).not.toHaveBeenCalledWith('cache', expect.anything(), 'usuario-b:sem-vinculo:toras');
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

describe("isolamento de contas no cache", () => {
  it("não entrega o estoque offline de uma conta a outra no mesmo celular", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const get = vi.spyOn(idb, "get").mockResolvedValue(undefined);
    informarConexao(true);
  idUsuario = "usuario-a";
    await comCache("toras", vi.fn());
    expect(get).toHaveBeenCalledWith("cache", "usuario-a:sem-vinculo:toras");
    idUsuario = "usuario-b";
    await comCache("toras", vi.fn());
    expect(get).toHaveBeenCalledWith("cache", "usuario-b:sem-vinculo:toras");
  });
  it("sem sessão não consulta dados privados salvos", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const get = vi.spyOn(idb, "get");
    idUsuario = "";
    expect(await comCache("toras", vi.fn())).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});

it('não guarda resposta iniciada por uma conta na conta que entrou depois', async () => {
  const put = vi.spyOn(idb, 'put').mockResolvedValue(undefined);
  let resolver: ((rows: { plaqueta: number }[]) => void) | undefined;
  const p = comCache('toras', () => new Promise<{ plaqueta: number }[]>(resolve => { resolver = resolve; }));
  await vi.waitFor(() => expect(resolver).toBeTypeOf('function'));
  idUsuario = 'usuario-b'; resolver?.([{ plaqueta: 39 }]);
  expect(await p).toEqual([]);
  expect(put).not.toHaveBeenCalledWith('cache', expect.anything(), expect.stringContaining('usuario-b'));
});
it('Wi-Fi sem backend e sem cache devolve lista vazia, sem inventar dados', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.spyOn(idb, 'get').mockResolvedValue(undefined);
  expect(await comCache('toras', async () => { throw new TypeError('Failed to fetch'); })).toEqual([]);
});
it('nega cache privado quando servidor responde permissão revogada', async () => {
  vi.spyOn(idb, 'get').mockResolvedValue({ dados: [{ plaqueta: 39 }] });
  await expect(comCache('toras', async () => { throw new Error('permission denied'); })).rejects.toThrow('permission denied');
});

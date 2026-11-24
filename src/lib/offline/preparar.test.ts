import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  guardar: vi.fn(),
  from: vi.fn(),
  session: vi.fn(),
  empresa: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("./cache", () => ({ guardarCopiaOffline: mocks.guardar }));
vi.mock("./sessao", () => ({ sessaoDoAparelho: mocks.session }));
vi.mock("@/lib/empresa", () => ({ getEmpresaAtiva: mocks.empresa, lerEmpresaSalva: () => null }));
vi.mock("@/lib/mapa-pdf", () => ({ baixarMapaPdf: vi.fn() }));
import { baixarPaginas, prepararDadosOffline } from "./preparar";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "u" } });
  mocks.empresa.mockReturnValue("e");
  mocks.guardar.mockResolvedValue(undefined);
  mocks.from.mockImplementation((tabela: string) => {
    const q = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
      abortSignal: vi.fn(),
      filter: vi.fn(),
    };
    for (const metodo of ["select", "eq", "order", "range", "filter"] as const)
      q[metodo].mockReturnValue(q);
    q.order.mockImplementation((coluna: string) => {
      if (
        coluna === "id" &&
        ["toras", "autex", "motoristas", "veiculos", "patios", "saldos"].includes(tabela)
      )
        throw new Error("Coluna id não existe nesta tabela");
      return q;
    });
    q.abortSignal.mockResolvedValue({ data: [], error: null });
    return q;
  });
});

it("baixa todas as páginas inclusive mais de mil registros", async () => {
  const rows = Array.from({ length: 1203 }, (_, id) => ({ id }));
  const buscar = vi.fn(async (a: number, b: number) => rows.slice(a, b + 1));
  expect(await baixarPaginas(buscar)).toEqual(rows);
  expect(buscar.mock.calls).toEqual([
    [0, 499],
    [500, 999],
    [1000, 1499],
  ]);
});

it("prepara as bases sem visitar telas e confirma somente depois de guardar", async () => {
  const p = await prepararDadosOffline("u", "e", vi.fn());
  expect(p.falhas).toEqual([]);
  for (const key of [
    "toras",
    "arvores",
    "romaneios",
    "madeira-serrada:e",
    "cargas-serradas:e",
    "clientes:e",
    "saldo-linhas:e",
  ])
    expect(mocks.guardar).toHaveBeenCalledWith(key, [], "e", "u");
  expect(mocks.guardar).toHaveBeenLastCalledWith(
    "preparacao-offline",
    [expect.any(Number)],
    "e",
    "u",
  );
});

it("quota cheia não anuncia preparação concluída nem apaga bases anteriores", async () => {
  mocks.guardar.mockImplementation(async (nome: string) => {
    if (nome === "toras") throw new Error("QuotaExceededError");
  });
  const p = await prepararDadosOffline("u", "e", vi.fn());
  expect(p.falhas).toContain("Toras: QuotaExceededError");
  expect(p.atualizadoEm).toBeUndefined();
  expect(mocks.guardar).not.toHaveBeenCalledWith(
    "preparacao-offline",
    expect.anything(),
    expect.anything(),
    expect.anything(),
  );
});

it("troca de identidade interrompe a cópia antes de guardar dados", async () => {
  mocks.session.mockResolvedValue({ user: { id: "outro" } });
  await expect(prepararDadosOffline("u", "e", vi.fn())).rejects.toThrow("troca de conta");
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.guardar).not.toHaveBeenCalled();
});

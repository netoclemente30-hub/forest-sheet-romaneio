import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), listUsers: vi.fn(), from: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { auth: { admin: { listUsers: mocks.listUsers } }, from: mocks.from },
}));
import { listarUsuarios } from "./usuarios.functions";
const listar = listarUsuarios as unknown as (input: { context: unknown }) => Promise<unknown>;
const context = { userId: "admin-a", supabase: { rpc: mocks.rpc } };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.listUsers.mockResolvedValue({ data: { users: [
    { id: "a", email: "a@example.test" }, { id: "b", email: "b@example.test" },
  ] }, error: null });
  mocks.from.mockImplementation((table: string) => {
    const response = { data: table === "empresa_usuarios"
      ? [{ user_id: "a", empresa_id: "empresa-a" }, { user_id: "b", empresa_id: "empresa-b" }]
      : [], error: null };
    return { select: () => ({ ...response, in: () => Promise.resolve(response) }) };
  });
});

describe("listagem administrativa no servidor", () => {
  for (const falha of [false, true]) {
    it(`nega admin sem empresa (erro de consulta: ${falha}) antes de usar acesso privilegiado`, async () => {
      mocks.rpc.mockImplementation((name: string, args?: { _role: string }) => Promise.resolve({
        data: name === "has_role" ? args?._role === "admin" : null,
        error: name === "admin_minha_empresa" && falha ? { message: "Falha de vínculo" } : null,
      }));
      await expect(listar({ context })).rejects.toThrow();
      expect(mocks.listUsers).not.toHaveBeenCalled();
    });
  }
  it("admin recebe somente funcionários da própria empresa", async () => {
    mocks.rpc.mockImplementation((name: string, args?: { _role: string }) => Promise.resolve({
      data: name === "has_role" ? args?._role === "admin" : "empresa-a", error: null,
    }));
    expect(await listar({ context })).toEqual([expect.objectContaining({ id: "a" })]);
  });
  it("somente superadmin pode listar empresas diferentes", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    expect(await listar({ context })).toHaveLength(2);
  });
  it("nega funcionário comum", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(listar({ context })).rejects.toThrow();
    expect(mocks.listUsers).not.toHaveBeenCalled();
  });
});

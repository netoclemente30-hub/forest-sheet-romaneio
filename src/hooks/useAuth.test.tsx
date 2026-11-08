import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "./useAuth";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSession: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: mocks.unsubscribe } } }),
    },
    rpc: mocks.rpc,
  },
}));

const session = { user: { id: "usuario-rj" } };

beforeEach(() => {
  mocks.getSession.mockResolvedValue({ data: { session } });
  mocks.rpc.mockImplementation((nome: string) => Promise.resolve({ data: nome === "minha_empresa" ? null : false, error: nome === "minha_empresa" ? { message: "Sem conexão" } : null }));
});

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("empresa do usuário no aparelho", () => {
  it("usa a empresa já confirmada quando a consulta online falha", async () => {
    localStorage.setItem("encaixe-empresa:usuario-rj", "empresa-rj");
    const { result } = renderHook(useAuth);
    await waitFor(() => expect(result.current.empresaId).toBe("empresa-rj"));
  });

  it("guarda a empresa confirmada online somente para o usuário correspondente", async () => {
    mocks.rpc.mockImplementation((nome: string) => Promise.resolve({ data: nome === "minha_empresa" ? "empresa-rj" : false, error: null }));
    const { result } = renderHook(useAuth);
    await waitFor(() => expect(result.current.empresaId).toBe("empresa-rj"));
    expect(localStorage.getItem("encaixe-empresa:usuario-rj")).toBe("empresa-rj");
    expect(localStorage.getItem("encaixe-empresa:outro-usuario")).toBeNull();
  });
});

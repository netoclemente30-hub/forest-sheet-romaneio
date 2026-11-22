import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { salvarPermissoes } from "@/lib/offline/permissoes";
import { useAuth } from "./useAuth";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSession: vi.fn(), unsubscribe: vi.fn(), authCallback: undefined as undefined | ((event: string, session: { user: { id: string } } | null) => void) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: (callback: typeof mocks.authCallback) => { mocks.authCallback = callback; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }; },
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
  vi.restoreAllMocks();
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

  it("carrega empresa-rj mesmo quando a consulta de permissões não responde", async () => {
    mocks.rpc.mockImplementation((nome: string) => nome === "minha_empresa"
      ? Promise.resolve({ data: "empresa-rj", error: null })
      : new Promise(() => {}));
    const { result } = renderHook(useAuth);
    await waitFor(() => expect(result.current.empresaId).toBe("empresa-rj"));
    expect(result.current.loading).toBe(false);
  });

  it("não inicia consultas dentro do aviso de login", async () => {
    const { result } = renderHook(useAuth);
    await waitFor(() => expect(result.current.loading).toBe(false));
    mocks.rpc.mockClear();
    act(() => mocks.authCallback?.("SIGNED_IN", session));
    expect(mocks.rpc).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("minha_empresa"));
  });

  it("recupera empresa-rj ao reconectar após falha inicial sem vínculo salvo", async () => {
    const { result } = renderHook(useAuth);
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("minha_empresa"));
    expect(result.current.empresaId).toBeNull();
    mocks.rpc.mockImplementation((nome: string) => Promise.resolve({ data: nome === "minha_empresa" ? "empresa-rj" : false, error: null }));
    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(result.current.empresaId).toBe("empresa-rj"));
  });

  it("ignora uma resposta antiga da empresa depois de sair", async () => {
    let resolver: ((value: { data: string; error: null }) => void) | undefined;
    mocks.rpc.mockImplementation((nome: string) => nome === "minha_empresa"
      ? new Promise((resolve) => { resolver = resolve; })
      : Promise.resolve({ data: false, error: null }));
    const { result } = renderHook(useAuth);
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("minha_empresa"));
    act(() => mocks.authCallback?.("SIGNED_OUT", null));
    await act(async () => resolver?.({ data: "empresa-rj", error: null }));
    expect(result.current.session).toBeNull();
    expect(result.current.empresaId).toBeNull();
    expect(localStorage.getItem("encaixe-empresa:usuario-rj")).toBeNull();
  });
});


describe("revogação de permissões", () => {
  it("mantém o cargo validado quando somente a rede falha", async () => {
    mocks.rpc.mockImplementation((nome: string) => Promise.resolve({
      data: nome === "minha_empresa" ? "empresa-rj" : nome === "minha_funcao" ? "cortador" : false, error: null,
    }));
    const { result } = renderHook(useAuth);
    await waitFor(() => expect(result.current.papel).toBe("cortador"));
    mocks.rpc.mockRejectedValue(new Error("Falha de rede"));
    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(result.current.estadoPermissoes).toBe("offline"));
    expect(result.current.papel).toBe("cortador");
    expect(result.current.permissoesCarregando).toBe(false);
  });
  it("não aceita resposta de cargo administrativo acompanhada de erro", async () => {
    mocks.rpc.mockImplementation((nome: string) => Promise.resolve({
      data: nome === "has_role" ? true : null, error: { message: "Consulta inválida" },
    }));
    const { result } = renderHook(useAuth);
    await waitFor(() => expect(result.current.permissoesCarregando).toBe(false));
    expect(result.current.papel).toBe("sem_funcao");
  });
});


it("reabre offline com cargo confirmado da própria conta sem consultar rede", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  localStorage.setItem("encaixe-empresa:usuario-rj", "empresa-rj");
  salvarPermissoes({ usuario: "usuario-rj", empresa: "empresa-rj", admin: false, superadmin: false, funcao: "cortador", validadoEm: 1 });
  const { result } = renderHook(useAuth);
  await waitFor(() => expect(result.current.papel).toBe("cortador"));
  expect(mocks.rpc).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});
it("não usa cargo offline de outra conta", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  localStorage.setItem("permissoes-offline:usuario-rj", JSON.stringify({ usuario: "outro", admin: true }));
  const { result } = renderHook(useAuth);
  await waitFor(() => expect(result.current.permissoesCarregando).toBe(false));
  expect(result.current.papel).toBe("sem_funcao");
  vi.restoreAllMocks();
});

function cargoConfirmado() {
  mocks.rpc.mockImplementation((nome: string) => Promise.resolve({ data: nome === 'minha_empresa' ? 'empresa-rj' : nome === 'minha_funcao' ? 'romaneador' : false, error: null }));
}
it('substitui cargo revogado por ausência real após resposta válida ao reconectar', async () => {
  cargoConfirmado();
  const { result } = renderHook(useAuth);
  await waitFor(() => expect(result.current.papel).toBe('romaneador'));
  mocks.rpc.mockImplementation((nome: string) => Promise.resolve({ data: nome === 'minha_empresa' ? 'empresa-rj' : null, error: null }));
  act(() => window.dispatchEvent(new Event('online')));
  await waitFor(() => expect(result.current.papel).toBe('sem_funcao'));
  expect(result.current.estadoPermissoes).toBe('validado');
  expect(JSON.parse(localStorage.getItem('permissoes-validadas-v2:usuario-rj:empresa-rj') ?? '{}').funcao).toBeNull();
});
it('nega acesso e invalida cópia diante de resposta de autorização negada', async () => {
  cargoConfirmado();
  const { result } = renderHook(useAuth);
  await waitFor(() => expect(result.current.papel).toBe('romaneador'));
  mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
  act(() => window.dispatchEvent(new Event('online')));
  await waitFor(() => expect(result.current.papel).toBe('sem_funcao'));
  expect(localStorage.getItem('permissoes-validadas-v2:usuario-rj:empresa-rj')).toBeNull();
});
it('não transfere cargo nem empresa ao trocar para outra conta offline', async () => {
  cargoConfirmado();
  const { result } = renderHook(useAuth);
  await waitFor(() => expect(result.current.papel).toBe('romaneador'));
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  act(() => mocks.authCallback?.('SIGNED_IN', { user: { id: 'outra-conta' } }));
  await waitFor(() => expect(result.current.papel).toBe('sem_funcao'));
  expect(result.current.empresaId).toBeNull();
  expect(result.current.estadoPermissoes).toBe('indisponivel');
});
it('não usa cargo validado para outra empresa da mesma conta', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  localStorage.setItem('encaixe-empresa:usuario-rj', 'empresa-nova');
  salvarPermissoes({ usuario: 'usuario-rj', empresa: 'empresa-antiga', admin: true, superadmin: false, funcao: null, validadoEm: 1 });
  const { result } = renderHook(useAuth);
  await waitFor(() => expect(result.current.permissoesCarregando).toBe(false));
  expect(result.current.papel).toBe('sem_funcao');
});
it('retoma depois de tela oculta sem apagar cargo em falha de rede', async () => {
  cargoConfirmado();
  const { result } = renderHook(useAuth);
  await waitFor(() => expect(result.current.papel).toBe('romaneador'));
  mocks.rpc.mockRejectedValue(new TypeError('Failed to fetch'));
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  await waitFor(() => expect(result.current.estadoPermissoes).toBe('offline'));
  expect(result.current.papel).toBe('romaneador');
});

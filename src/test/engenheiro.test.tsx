import type { ComponentProps } from "react";
import { IDBFactory } from "fake-indexeddb";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EngenheiroPagina } from "@/components/engenheiro/EngenheiroPagina";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: ComponentProps<"a"> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: () => "/engenheiro",
  Outlet: () => <EngenheiroPagina />,
  Navigate: () => null,
  useNavigate: () => vi.fn(),
}));
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAuth", () => ({ useAuth: auth }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));
vi.mock("@/lib/usuarios.functions", () => ({ listarEmpresas: vi.fn() }));
vi.mock("@/lib/registro", () => ({ registrarLogin: vi.fn() }));
vi.mock("@/lib/aparelho", () => ({}));
vi.mock("@/components/SituacaoEmpresa", () => ({}));
vi.mock("@/components/SyncStatus", () => ({}));
vi.mock("@/components/PrepararOffline", () => ({}));
vi.mock("@/components/apresentacao/ApresentacaoPagina", () => ({}));
vi.mock("@/components/Aparencia", () => ({}));

const SEM_SESSAO = {
  session: null,
  loading: false,
  permissoesCarregando: false,
  estadoPermissoes: "indisponivel",
  papel: "sem_funcao",
};
const ENGENHEIRO = {
  session: { user: { id: "u-eng", email: "eng@gestorflorestal.com.br" } },
  loading: false,
  permissoesCarregando: false,
  estadoPermissoes: "validado",
  papel: "engenheiro",
};

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("Área do Engenheiro", () => {
  it("sem login oferece voltar ao início (raiz), não à apresentação", () => {
    auth.mockReturnValue(SEM_SESSAO);
    render(<EngenheiroPagina />);
    expect(screen.getByRole("heading", { name: "Área do Engenheiro" })).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    const voltar = screen.getByRole("link", { name: "Voltar ao início" });
    expect(voltar).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: /apresenta/i })).not.toBeInTheDocument();
  });
  it("logado navega pelas abas, oferece Início (raiz) e não anuncia sincronização ativa", async () => {
    auth.mockReturnValue(ENGENHEIRO);
    render(<EngenheiroPagina />);
    for (const tab of screen.getAllByRole("tab")) {
      fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
      expect(tab).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    }
    expect(
      await screen.findByText(
        "Armazenamento exclusivamente local. Não há sincronização com servidor.",
      ),
    ).toBeInTheDocument();
    const inicio = screen.getByRole("link", { name: /Início/ });
    expect(inicio).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: /apresenta/i })).not.toBeInTheDocument();
  });
});

import { IDBFactory } from "fake-indexeddb";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EngenheiroPagina } from "@/components/engenheiro/EngenheiroPagina";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: () => "/engenheiro",
  Outlet: () => <EngenheiroPagina />,
  Navigate: () => null,
}));
const auth = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("Operational authentication must not mount");
  }),
);
vi.mock("@/hooks/useAuth", () => ({ useAuth: auth }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/usuarios.functions", () => ({ listarEmpresas: vi.fn() }));
vi.mock("@/lib/registro", () => ({ registrarLogin: vi.fn() }));
vi.mock("@/lib/aparelho", () => ({}));
vi.mock("@/components/SituacaoEmpresa", () => ({}));
vi.mock("@/components/SyncStatus", () => ({}));
vi.mock("@/components/PrepararOffline", () => ({}));
vi.mock("@/components/apresentacao/ApresentacaoPagina", () => ({}));
vi.mock("@/components/Aparencia", () => ({}));
import { AppShell } from "@/components/AppShell";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("Área do Engenheiro", () => {
  it("abre vazia sem montar autenticação e consultas de Manejo/Serraria", () => {
    render(<AppShell />);
    expect(auth).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Área do Engenheiro" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(11);
    expect(screen.queryByRole("tab", { name: "Manejo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Serraria" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar à apresentação" })).toHaveAttribute(
      "href",
      "/apresentacao",
    );
  });
  it("permite navegar pelas abas e não anuncia sincronização ativa", async () => {
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
  });
});

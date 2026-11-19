import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToraForm } from "./ToraForm";
import type { Tora } from "@/lib/data";

const mocks = vi.hoisted(() => ({ error: vi.fn(), insert: vi.fn(), listar: vi.fn(), enfileirar: vi.fn(), selectResult: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ empresaId: "rj" }) }));
vi.mock("./AutexPicker", () => ({ AutexPicker: () => null }));
vi.mock("@/lib/empresa", () => ({ getEmpresaAtiva: () => null }));
vi.mock("@/lib/offline/fila", () => ({ fila: () => ({ listar: mocks.listar, enfileirar: mocks.enfileirar }) }));
vi.mock("@/lib/registro", () => ({ capturarLog: vi.fn(), gravarRegistro: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ insert: mocks.insert, select: () => ({ eq: () => ({ eq: mocks.selectResult }) }) }) } }));

const linha = { arvore: 1861, secao: "B", autex: "AUTEX-2011.2.2026.10587", especie: "Abiurana", nome_cientifico: "Pouteria macrophylla", volume: 2.0125 };
const existente = { ...linha, plaqueta: 5009, empresa_id: "rj", comprimento: 6, d_topo1: 50, carregada: false } as Tora;

function preencher(toras: Tora[]) {
  render(<QueryClientProvider client={new QueryClient()}><ToraForm toras={toras} arvores={[]} saldo={[linha]} onSaved={vi.fn()} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText("Nº árvore"), { target: { value: "1861" } });
  fireEvent.change(screen.getByLabelText("Secção (opcional)"), { target: { value: "b" } });
  for (const label of ["D. Topo 1 (cm)", "D. Topo 2 (cm)", "D. Pé 1 (cm)", "D. Pé 2 (cm)", "Comprimento (m)"]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: "50" } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Salvar tora" }));
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.listar.mockResolvedValue([]);
  mocks.selectResult.mockResolvedValue({ data: [], error: null });
});
afterEach(cleanup);

describe("lançar novamente 1861-B do saldo", () => {
  it("não grava outra tora quando a AUTEX é preenchida pelo saldo", async () => {
    preencher([existente]);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Árvore 1861 já tem a secção B (plaqueta 5009)"));
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.enfileirar).not.toHaveBeenCalled();
  });
  it("não grava duplicata de um lançamento ainda na fila offline", async () => {
    mocks.listar.mockResolvedValue([{ op: { tipo: "tora_insert", dados: existente } }]);
    preencher([]);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Árvore 1861 já tem a secção B (plaqueta 5009)"));
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.enfileirar).not.toHaveBeenCalled();
  });
  it("guarda localmente mesmo se navegador disser online sem sinal, sem envio direto", async () => {
    mocks.selectResult.mockResolvedValue({ data: [existente], error: null });
    preencher([]);
    await waitFor(() => expect(mocks.enfileirar).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'tora_insert', dados: expect.objectContaining({ empresa_id: 'rj', arvore: 1861 }) })));
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.selectResult).not.toHaveBeenCalled();
  });
});
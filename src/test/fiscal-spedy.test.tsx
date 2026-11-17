import { it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route } from "@/routes/fiscal";
import { verificarSandbox } from "@/lib/spedy.server";

const auth = vi.hoisted(() => ({ empresa: "a" }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    empresaId: auth.empresa,
    session: { user: { id: "usuario" } },
    papel: "admin_empresa",
  }),
}));
vi.mock("@/lib/spedy.functions", () => ({ verificarSpedy: vi.fn() }));
vi.mock("@/lib/fiscal-cargas", () => ({
  cargasFiscais: async () => [{ id: "toras/1", nome: "Carga 1" }],
  importarCarga: async () => ({
    numero: "C-1",
    data: "2026-11-10",
    itens: [{ descricao: "Jatobá", quantidade: 1.5, unidade: "M3", ncm: "44034900" }],
  }),
}));
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("confere a carga, salva a prévia, simula assinatura e separa o histórico por empresa", async () => {
  const client = new QueryClient();
  const Fiscal = Route.options.component!;
  const tela = () => (
    <QueryClientProvider client={client}>
      <Fiscal />
    </QueryClientProvider>
  );
  const view = render(tela());
  for (const [label, valor] of [
    ["Razão social", "Madeireira A"],
    ["CNPJ", "11222333000181"],
    ["Inscrição estadual", "1234"],
  ] as const) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: valor } });
  }
  fireEvent.click(screen.getByText("Salvar cadastro"));
  fireEvent.click(screen.getByText("Simular contratação"));
  await screen.findByText("Carga 1");
  fireEvent.change(screen.getByLabelText("Romaneio"), { target: { value: "toras/1" } });
  fireEvent.change(await screen.findByLabelText("Destinatário"), {
    target: { value: "Cliente de teste" },
  });
  fireEvent.change(screen.getByLabelText(/Preço por m³/), { target: { value: "250,50" } });
  fireEvent.click(screen.getByText("Gerar prévia e salvar rascunho"));
  expect(screen.getByText(/Total dos produtos/)).toHaveTextContent("375,75");
  fireEvent.click(screen.getByText("Simular assinatura digital"));
  expect(screen.getByRole("heading", { name: /Prévia.*Assinatura simulada/ })).toBeVisible();
  auth.empresa = "b";
  view.rerender(tela());
  expect(screen.getByText("Nenhum rascunho salvo.")).toBeVisible();
  expect(screen.getByLabelText("Razão social")).toHaveValue("");
  auth.empresa = "a";
  view.rerender(tela());
  fireEvent.click(screen.getByRole("button", { name: /C-1.*Assinatura simulada/ }));
  expect(within(view.container).getByText(/Destinatário · Cliente de teste/)).toBeVisible();
});
it("consulta somente o sandbox e usa exclusivamente a chave da empresa", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const http = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", http);
  vi.stubEnv("SPEDY_SANDBOX_KEY_00000000_0000_4000_8000_000000000001", "fixture");
  expect(await verificarSandbox(id)).toMatch(/aceitou/);
  expect(http).toHaveBeenCalledWith(
    "https://sandbox-api.spedy.com.br/v1/product-invoices?pageSize=1",
    expect.objectContaining({
      method: "GET",
      redirect: "error",
      headers: { "X-Api-Key": "fixture" },
    }),
  );
  expect(await verificarSandbox(id.replace(/1$/, "2"))).toMatch(/pendente/);
  expect(http).toHaveBeenCalledTimes(1);
});

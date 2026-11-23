import { it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
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
vi.mock("@/lib/spedy.functions", () => ({ verificarSpedy: vi.fn(), diagnosticarSpedy: vi.fn(), emitirNfeHomologacao: vi.fn(), consultarNfeHomologacao: vi.fn(), baixarNfeHomologacao: vi.fn(), inutilizarHomologacao: vi.fn(), verificarCadastroSpedy: vi.fn(), cadastrarEmpresaSpedy: vi.fn(), enviarCertificadoSpedy: vi.fn() }));
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
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
vi.setConfig({ testTimeout: 30000 });

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
  fireEvent.change(await screen.findByLabelText(/Preço por m³/, {}, { timeout: 10000 }), { target: { value: "250,50" } });
  for (const [label, value] of Object.entries({
    "CPF ou CNPJ do destinatário": "11222333000181",
    Logradouro: "Rua das Toras",
    Número: "42",
    Complemento: "Galpão A",
    Bairro: "Centro",
    Município: "Manaus",
    UF: "AM",
    CEP: "69000-000",
    "Modalidade do frete": "1",
    "Informações adicionais de interesse do Fisco (opcional)": "Observação de teste",
  })) {
    fireEvent.change(screen.getAllByLabelText(label)[0]!, { target: { value } });
  }
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
  expect(screen.getByText(/Modalidade do frete · FOB/)).toBeVisible();
  expect(screen.getByText(/Endereço · Rua das Toras, 42, Galpão A/)).toBeVisible();
  expect(screen.getByText(/Fisco · Observação de teste/)).toBeVisible();
  fireEvent.click(screen.getByText("Editar dados da nota"));
  expect(screen.getByLabelText("Tipo da nota")).toHaveValue("1");
  fireEvent.change(screen.getByLabelText("Tipo da nota"), { target: { value: "0" } });
  fireEvent.change(screen.getByLabelText("Modalidade do frete"), { target: { value: "0" } });
  fireEvent.click(screen.getByText("Salvar alterações"));
  expect(screen.getByText(/Modalidade do frete · CIF/)).toBeVisible();
  expect(screen.getByText(/Modelo 55 · Entrada · Série/)).toBeVisible();
  fireEvent.click(screen.getByText("Editar dados da nota"));
  expect(screen.getByLabelText("Tipo da nota")).toHaveValue("0");
  fireEvent.click(screen.getByText("Cancelar"));
  expect(screen.getByRole("heading", { name: "Prévia da NF-e · Rascunho" })).toBeVisible();
});
it("completa um rascunho anterior sem substituir carga, emitente ou preços", async () => {
  const chave = "fiscal-spedy-v1:usuario:a";
  const cadastro = { nome: "Emitente antigo", cnpj: "11222333000181", ie: "1234" };
  const antigo = {
    origem: "toras/antiga",
    cadastro,
    carga: {
      numero: "R-antigo",
      data: "2026-01-01",
      cliente: { nome: "Cliente antigo", documento: "12345678909" },
      itens: [],
    },
    itens: [],
    total: 3400,
    criado: "2026-01-01",
    assinado: false,
  };
  sessionStorage.setItem(
    chave,
    JSON.stringify({ cadastro, assinatura: true, historico: [antigo] }),
  );
  const Fiscal = Route.options.component!;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Fiscal />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText("R-antigo · Rascunho"));
  fireEvent.click(screen.getByText("Editar dados da nota"));
  await waitFor(() => expect(screen.getAllByLabelText("CPF ou CNPJ do destinatário")[0]).toHaveValue("12345678909"), { timeout: 10000 });
  for (const [label, value] of Object.entries({
    Logradouro: "Rua A",
    Número: "15",
    Bairro: "Centro",
    Município: "Manaus",
    UF: "AM",
    CEP: "69000000",
    "Modalidade do frete": "9",
  })) {
    fireEvent.change(screen.getAllByLabelText(label)[0]!, { target: { value } });
  }
  fireEvent.click(screen.getByText("Salvar alterações"));
  expect(JSON.parse(localStorage.getItem(chave + ':rascunhos') ?? '{}').historico).toEqual([
    { ...antigo, detalhes: expect.objectContaining({ modFrete: "9" }) },
  ]);
});
it("consulta CNPJ, cadastra cliente e produto e reutiliza os dados ao preparar a nota", async () => {
  const cnpj = "11222333000181";
  const http = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      cnpj,
      razao_social: "Madeiras Exemplo",
      logradouro: "Rua A",
      numero: "10",
      bairro: "Centro",
      municipio: "Manaus",
      uf: "AM",
      cep: "69000000",
    }),
  });
  vi.stubGlobal("fetch", http);
  const Fiscal = Route.options.component!;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Fiscal />
    </QueryClientProvider>,
  );
  const preencher = (label: string, value: string) =>
    fireEvent.change(screen.getAllByLabelText(label)[0]!, { target: { value } });
  preencher("CNPJ", cnpj);
  await screen.findByDisplayValue("Madeiras Exemplo", {}, { timeout: 10000 });
  expect(screen.getByLabelText("Município do emitente")).toHaveValue("Manaus");
  preencher("Inscrição estadual", "123");
  fireEvent.click(screen.getByText("Salvar cadastro"));
  fireEvent.click(screen.getByText("Simular contratação"));
  fireEvent.click(screen.getByText("Cadastros de clientes e produtos"));
  preencher("CPF ou CNPJ do destinatário", cnpj);
  await waitFor(() => expect(screen.getByLabelText("Logradouro")).toHaveValue("Rua A"), {
    timeout: 10000,
  });
  fireEvent.click(screen.getByText("Salvar cliente"));
  expect(localStorage.getItem("fiscal-spedy-v1:usuario:a:cadastros:cliente:" + cnpj)).toContain(
    "Manaus",
  );
  fireEvent.click(screen.getByRole("button", { name: "Produtos" }));
  for (const [label, v] of Object.entries({
    "Código do item": "JAT",
    "Descrição do produto": "Jatobá serrado",
    NCM: "44072990",
    "CFOP padrão": "5101",
    "Preço padrão por m³ (R$)": "120",
  }))
    preencher(label, v);
  fireEvent.click(screen.getByText("Salvar produto"));
  fireEvent.click(screen.getByText("Cadastros de clientes e produtos"));
  await screen.findByText("Carga 1");
  preencher("Romaneio", "toras/1");
  await screen.findByLabelText("Buscar cliente cadastrado");
  preencher("Buscar cliente cadastrado", cnpj);
  expect(screen.getByLabelText("Município")).toHaveValue("Manaus");
  fireEvent.click(screen.getByRole("button", { name: "Produtos" }));
  preencher("Produto cadastrado", "JAT");
  expect(screen.getByLabelText("NCM da operação")).toHaveValue("44072990");
  expect(screen.getByLabelText("CFOP da operação")).toHaveValue("5101");
  fireEvent.click(screen.getByRole("button", { name: "Transporte" }));
  preencher("Modalidade do frete", "1");
  fireEvent.click(screen.getByText("Gerar prévia e salvar rascunho"));
  expect(screen.getByText(/Total dos produtos/)).toHaveTextContent("180,00");
  expect(screen.getByText(/Jatobá serrado · NCM/)).toHaveTextContent("CFOP 5101");
});
it("consulta somente o sandbox; empresa sem chave própria usa a chave mestra", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const http = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", http);
  vi.stubEnv("SPEDY_SANDBOX_KEY_00000000_0000_4000_8000_000000000001", "fixture");
  expect(await verificarSandbox(id)).toMatch(/aceitou/);
  expect(http).toHaveBeenCalledWith(
    "https://sandbox-api.spedy.com.br/v1/product-invoices?pageSize=1",
    expect.objectContaining({
      method: "GET",
      redirect: "manual",
      headers: { "X-Api-Key": "fixture" },
    }),
  );
  expect(await verificarSandbox(id.replace(/1$/, "2"))).toMatch(/aceitou/);
  expect(http).not.toHaveBeenCalledWith(expect.not.stringContaining("sandbox-api.spedy.com.br"), expect.anything());
});

import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import { ClienteRomaneio, clienteRomaneioVazio } from "@/components/ClienteRomaneio";
import { chaveFiscal } from "@/lib/fiscal";
vi.mock("@/components/ConsultaCnpjFiscal", () => ({ ConsultaCnpjFiscal: () => null }));
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function Formulario({ empresa = "empresa-a" }) {
  const [cliente, setCliente] = useState(clienteRomaneioVazio);
  return (
    <ClienteRomaneio
      empresa={empresa}
      usuario="u1"
      salvos={[]}
      cliente={cliente}
      alterar={setCliente}
    />
  );
}
it("cadastra João, reutiliza seus dados e separa por empresa", () => {
  const view = render(<Formulario />);
  for (const [label, value] of Object.entries({
    "Nome / razão social": "João",
    "CPF / CNPJ": "11144477735",
    Logradouro: "Estrada do Manejo",
    Número: "10",
    Complemento: "Lote A",
    Bairro: "Zona Rural",
    Município: "Manaus",
    UF: "AM",
    CEP: "69000000",
  })) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByText("Salvar cliente"));
  const chave = chaveFiscal("u1", "empresa-a") + ":cadastros:cliente:11144477735";
  expect(JSON.parse(localStorage.getItem(chave)!)).toMatchObject({
    nome: "João",
    endereco: { logradouro: "Estrada do Manejo", municipio: "Manaus" },
  });
  fireEvent.click(screen.getByText("Cadastrar novo cliente"));
  fireEvent.change(screen.getByLabelText("Selecionar cliente cadastrado"), {
    target: { value: "11144477735" },
  });
  expect(screen.getByLabelText("Nome / razão social")).toHaveValue("João");
  expect(screen.getByLabelText("Logradouro")).toHaveValue("Estrada do Manejo");
  view.rerender(<Formulario key="outra" empresa="empresa-b" />);
  expect(screen.queryByRole("option", { name: /João/ })).toBeNull();
  expect(screen.getByLabelText("Nome / razão social")).toHaveValue("");
});

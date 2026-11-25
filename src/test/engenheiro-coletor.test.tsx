import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { CoreLocal } from "@/components/engenheiro/CoreLocal";
import { salvarEstado, lerEstado } from "@/lib/engenheiro/banco";
import { vazio } from "@/lib/engenheiro/projeto";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("mostra volume antes das coordenadas, exige posição e grava DMC bloqueado", async () => {
  const factory = new IDBFactory();
  vi.stubGlobal("indexedDB", factory);
  await salvarEstado(
    {
      ...vazio(),
      clientes: [{ id: "c", nome: "Cliente" }],
      propriedades: [{ id: "f", clienteId: "c", nome: "Fazenda" }],
      projetos: [
        {
          id: "p",
          propriedadeId: "f",
          nome: "POA",
          tipo: "POA",
          zona: 20,
          hemisferio: "S",
          intensidadeMax: 20,
          percentualSementes: 10,
        },
      ],
      uts: [{ id: "u", projetoId: "p", nome: "UT1", areaHa: 100 }],
      especies: [
        {
          projetoId: "p",
          codigo: "e",
          nomePopular: "Teste",
          nomeCientifico: "Species exemplaris",
          dmcCm: 50,
          fatorForma: 0.7,
          statusLegal: "COMERCIAL",
        },
      ],
    },
    factory,
  );
  render(<CoreLocal aba="inventario" />);
  fireEvent.change(await screen.findByRole("combobox", { name: "Projeto" }), {
    target: { value: "p" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "UT" }), {
    target: { value: "u" },
  });
  for (const [name, value] of [
    ["Placa / número da árvore", "1"],
    ["Faixa / picada", "1"],
    ["DAP (cm)", "40"],
    ["Altura comercial (m)", "20"],
  ])
    fireEvent.change(screen.getByLabelText(name!), { target: { value } });
  fireEvent.change(screen.getByRole("combobox", { name: "Espécie" }), {
    target: { value: "e" },
  });
  expect(screen.getByText(/DAP 40.00 cm · G 0.1257 m² · V 1.7593 m³/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Salvar árvore localmente" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Latitude", { exact: true }), {
    target: { value: "-10" },
  });
  fireEvent.change(screen.getByLabelText("Longitude", { exact: true }), {
    target: { value: "-63" },
  });
  expect(screen.getByRole("status")).toHaveTextContent("Abaixo do DMC configurado");
  fireEvent.click(screen.getByRole("button", { name: "Salvar árvore localmente" }));
  await screen.findByText("UT1 / 1");
  expect((await lerEstado(factory)).censo[0]?.destinacao).toBe("REMANESCENTE");
});

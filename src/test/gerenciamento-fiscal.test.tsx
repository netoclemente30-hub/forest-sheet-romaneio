import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { copiarRascunho, detalhesIniciais, montarRascunho, idRascunho } from "@/lib/fiscal";
import { GerenciamentoFiscal } from "@/components/GerenciamentoFiscal";
afterEach(cleanup);
it.each(["toras/1", "serrada/2"])(
  "copia %s preservando carga e criando identidade independente",
  (origem) => {
    const carga = {
      numero: "R1",
      data: "2026-11-17",
      itens: [
        { codigo: "A", descricao: "Madeira", quantidade: 2.5, ncm: "44034900", unidade: "M3" },
      ],
    };
    const detalhes = {
      ...detalhesIniciais(carga),
      nome: "Cliente",
      cabecalho: {
        serie: "1",
        numero: "123",
        natureza: "Venda",
        finalidade: "1",
        tipo: "0" as const,
      },
    };
    const nota = montarRascunho(
      { nome: "Emitente", cnpj: "11222333000181", ie: "123" },
      carga,
      origem,
      detalhes,
      ["20"],
    );
    nota.assinado = true;
    const copia = copiarRascunho(nota);
    expect(idRascunho(copia)).not.toBe(idRascunho(nota));
    expect(copia.origem).toBe(origem);
    expect(copia.total).toBe(5000);
    expect(copia.assinado).toBe(false);
    expect(copia.detalhes?.cabecalho?.tipo).toBe("0");
    expect(copia.detalhes?.cabecalho?.numero).toBe("");
    copia.itens[0]!.quantidade = 99;
    expect(nota.itens[0]!.quantidade).toBe(2.5);
    expect(nota.detalhes.cabecalho?.numero).toBe("123");
  },
);
it("valida intervalo e guarda somente uma solicitação local de inutilização", () => {
  const salvar = vi.fn(() => true);
  render(
    <GerenciamentoFiscal
      notas={[]}
      abrir={vi.fn()}
      copiar={vi.fn()}
      nova={vi.fn()}
      inutilizacoes={[]}
      salvarInutilizacao={salvar}
    />,
  );
  fireEvent.click(screen.getByText("Inutilizar numeração"));
  for (const [label, value] of Object.entries({
    Série: "1",
    "Número inicial": "20",
    "Número final": "10",
    Justificativa: "Quebra na sequência para revisão",
  }))
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByText("Salvar solicitação em rascunho"));
  expect(salvar).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Número final"), { target: { value: "21" } });
  fireEvent.click(screen.getByText("Salvar solicitação em rascunho"));
  expect(salvar).toHaveBeenCalledWith(expect.objectContaining({ serie: 1, inicio: 20, fim: 21 }));
});

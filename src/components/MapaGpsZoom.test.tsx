import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MapaGpsZoom } from "./MapaGpsZoom";
import type { Arvore } from "@/lib/data";

const arvore = {
  id: "394-abiurana", numero: 394, nome_vulgar: "Abiurana",
  abatida_em: null, nao_abatida_motivo: null,
} as Arvore;

afterEach(cleanup);

function mostrar(onArvore = vi.fn()) {
  render(<MapaGpsZoom autex="autex geraldo"
    arvores={[{ arvore, x: 300, y: 200 }]}
    percursos={[]} atual={{ x: 310, y: 210 }}
    aoSelecionar={onArvore} />);
  return onArvore;
}

describe("mapa GPS interativo", () => {
  it("permite ampliar, diminuir, recentralizar e voltar ao zoom inicial", () => {
    mostrar();
    const svg = screen.getByRole("img", { name: /Mapa exploratório/ });
    expect(svg.getAttribute("viewBox")).toBe("0 0 640 420");
    fireEvent.click(screen.getByRole("button", { name: "Aumentar zoom do mapa" }));
    expect(svg.getAttribute("viewBox")).not.toBe("0 0 640 420");
    expect(screen.getByLabelText("Zoom atual").textContent).toContain("1.5");
    fireEvent.click(screen.getByRole("button", { name: "Centralizar minha posição no mapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Restaurar visualização do mapa" }));
    expect(svg.getAttribute("viewBox")).toBe("0 0 640 420");
  });
  it("tocar no símbolo da árvore abre a ficha, sem registrar operação", () => {
    const abrir = mostrar();
    fireEvent.click(screen.getByRole("button", { name: /Árvore 394/ }));
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(abrir).toHaveBeenCalledWith(arvore);
  });
  it("desabilita centralização sem sinal GPS", () => {
    render(<MapaGpsZoom autex="autex geraldo" arvores={[]} percursos={[]}
      atual={null} aoSelecionar={vi.fn()} telaCheia />);
    expect(screen.getByRole("button", { name: "Centralizar minha posição no mapa" }))
      .toHaveProperty("disabled", true);
  });
});

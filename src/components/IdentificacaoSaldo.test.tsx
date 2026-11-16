import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { textoIdentificacaoSaldo } from "./IdentificacaoSaldo";

function traduzir(el: HTMLElement) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const ns: Text[] = [];
  while (w.nextNode()) ns.push(w.currentNode as Text);
  for (const n of ns) { const f = document.createElement("font"); f.textContent = n.nodeValue; n.parentNode!.replaceChild(f, n); }
}
type R = { p?: number; arvore?: number | string | null; secao?: string | null; autex?: string | null };
const linhas: R[][] = [
  [{ p: 12, arvore: 117, secao: "B", autex: "AUTEX-1" }, { arvore: 48, secao: null, autex: null }],
  [{ arvore: 9, secao: "", autex: "AUTESP-2" }, { p: 3, arvore: 5, secao: "A", autex: "AUTEX-1" }],
  [],
];
// Mesma estrutura da lista do saldo: linhas com key por posição.
const Antiga = ({ rs }: { rs: R[] }) => <div>{rs.map((r, i) => <div key={i}>{r.p != null ? `Plaqueta ${r.p} · ` : ""}Árv. {r.arvore} · Sec. {r.secao || "–"} · AUTEX {r.autex || "—"}</div>)}</div>;
const Atual = ({ rs }: { rs: R[] }) => <div>{rs.map((r, i) => <div key={i}>{textoIdentificacaoSaldo(r.p, r)}</div>)}</div>;

describe("filtro do saldo com página traduzida pelo navegador", () => {
  it("reproduz a quebra da linha antiga ao trocar tora no estoque/fora", () => {
    const r = render(<Antiga rs={linhas[0]} />); traduzir(r.container);
    let erro: unknown; try { r.rerender(<Antiga rs={linhas[1]} />); } catch (e) { erro = e; } console.log("ERRO", String(erro), (erro as Error)?.name); expect(erro).toBeTruthy();
  });
  it("linha atual sobrevive a filtros, lista vazia e volta", () => {
    const r = render(<Atual rs={linhas[0]} />); traduzir(r.container);
    for (const rs of [linhas[1], linhas[2], linhas[0], linhas[1]]) expect(() => r.rerender(<Atual rs={rs} />)).not.toThrow();
  });
  it("texto com nulos e vazios", () => {
    expect(textoIdentificacaoSaldo(12, { arvore: 117, secao: "B", autex: "AUTEX-1" })).toBe("Plaqueta 12 · Árv. 117 · Sec. B · AUTEX AUTEX-1");
    expect(textoIdentificacaoSaldo(null, { arvore: 48, secao: null, autex: null })).toBe("Árv. 48 · Sec. – · AUTEX —");
  });
});

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fmtM3, fmtM3Sinal } from "@/lib/volume";

/** Simula o tradutor do Edge/Chrome: troca cada nó de texto por <font>. */
function traduzir(el: HTMLElement) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const ns: Text[] = [];
  while (w.nextNode()) ns.push(w.currentNode as Text);
  for (const n of ns) { const f = document.createElement("font"); f.textContent = n.nodeValue; n.parentNode!.replaceChild(f, n); }
}
const Antigo = ({ d }: { d: number }) => <span>Dif.: {d >= 0 ? "+" : ""}{fmtM3(d)} m³</span>;
const Atual = ({ d }: { d: number }) => <span>Dif.: {fmtM3Sinal(d)} m³</span>;
const Lista = ({ n }: { n: number }) => <div>{Array.from({ length: n }, (_, i) => <div key={i}>Plaqueta {i} · Árv. {i}</div>)}{n === 0 && <div>Nenhuma tora encontrada.</div>}<span>{n} toras · físico</span></div>;

describe("tela traduzida pelo navegador ao filtrar toras", () => {
  it("reproduz a quebra do sinal condicional antigo", () => {
    const r = render(<Antigo d={-1} />); traduzir(r.container);
    expect(() => r.rerender(<Antigo d={1} />)).toThrow(/NotFoundError|not a child|can not be found/);
  });
  it.each([[-1, 1], [1, -1], [0, -0.5]])("diferença %s → %s não quebra", (a, b) => {
    const r = render(<Atual d={a} />); traduzir(r.container);
    expect(() => r.rerender(<Atual d={b} />)).not.toThrow();
  });
  it.each([[2, 0], [0, 2], [3, 1]])("lista e contador %s → %s não quebram", (a, b) => {
    const r = render(<Lista n={a} />); traduzir(r.container);
    expect(() => r.rerender(<Lista n={b} />)).not.toThrow();
  });
  it("sinal: positivo e zero com +, negativo sem", () => {
    expect(fmtM3Sinal(1.5)).toBe("+" + fmtM3(1.5));
    expect(fmtM3Sinal(0)).toBe("+" + fmtM3(0));
    expect(fmtM3Sinal(0, false)).toBe(fmtM3(0));
    expect(fmtM3Sinal(-2)).toBe(fmtM3(-2));
  });
});

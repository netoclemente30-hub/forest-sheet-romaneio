import { render } from "@testing-library/react";
import { it } from "vitest";
function traduzir(el: HTMLElement) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const ns: Text[] = [];
  while (w.nextNode()) ns.push(w.currentNode as Text);
  for (const n of ns) { const f = document.createElement("font"); f.textContent = n.nodeValue; n.parentNode!.replaceChild(f, n); }
}
const Dif = ({ d }: { d: number }) => <span>Dif.: {d >= 0 ? "+" : ""}{d} m³</span>;
const Lista = ({ n }: { n: number }) => <div>{Array.from({ length: n }, (_, i) => <div key={i}>Plaqueta {i} · Árv. {i}</div>)}{n === 0 && <div>Nenhuma tora encontrada.</div>}</div>;
const Cont = ({ n }: { n: number }) => <span>{n} toras · físico</span>;
for (const [nome, C, a, b] of [["dif - para +", Dif, -1, 1], ["dif + para -", Dif, 1, -1], ["lista 2→0", Lista, 2, 0], ["lista 0→2", Lista, 0, 2], ["contador", Cont, 5, 0]] as const)
  it(nome, () => { const r = render(<C {...({ d: a, n: a } as never)} />); traduzir(r.container); try { r.rerender(<C {...({ d: b, n: b } as never)} />); console.log(nome, "OK"); } catch (e) { console.log(nome, "FALHA", String(e).slice(0, 120)); } });

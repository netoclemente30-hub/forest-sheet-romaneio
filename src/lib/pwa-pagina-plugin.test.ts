import { afterEach, describe, expect, it, vi } from "vitest";
import { paginaOfflinePlugin } from "./pwa-policy";

const html = '<script type="module" src="/assets/index-NOVO.js"></script><link rel="modulepreload" href="/assets/rota-NOVO.js">';
function pagina(corpo = html, redirected = false) {
  const r = new Response(corpo, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  if (redirected) Object.defineProperty(r, "redirected", { value: true });
  return r;
}
function comCache(presentes: string[]) {
  vi.stubGlobal("caches", { match: async (u: string) => (presentes.includes(u) ? new Response("") : undefined) });
}
afterEach(() => vi.unstubAllGlobals());

describe("páginas offline consistentes com os arquivos salvos", () => {
  it("não guarda página nova cujos arquivos o worker antigo ainda não tem", async () => {
    comCache(["/assets/index-NOVO.js"]);
    expect(await paginaOfflinePlugin.cacheWillUpdate({ response: pagina() })).toBeNull();
  });
  it("guarda página quando todos os arquivos estão salvos", async () => {
    comCache(["/assets/index-NOVO.js", "/assets/rota-NOVO.js"]);
    expect(await paginaOfflinePlugin.cacheWillUpdate({ response: pagina() })).not.toBeNull();
  });
  it("não abre página salva com arquivos ausentes (usa a página offline)", async () => {
    comCache([]);
    expect(await paginaOfflinePlugin.cachedResponseWillBeUsed({ cachedResponse: pagina() })).toBeNull();
  });
  it("remove a marca de redirecionamento que o navegador recusa", async () => {
    comCache(["/assets/index-NOVO.js", "/assets/rota-NOVO.js"]);
    const r = await paginaOfflinePlugin.cachedResponseWillBeUsed({ cachedResponse: pagina(html, true) });
    expect(r?.redirected).toBe(false);
    expect(await r?.text()).toBe(html);
  });
});

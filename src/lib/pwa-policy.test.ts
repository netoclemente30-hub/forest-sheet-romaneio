import { describe, expect, it } from "vitest";
import { navegacaoOffline, PAGINAS_OFFLINE } from "./pwa-policy";

function request(path: string, mode = "navigate", marked = false) {
  return {
    url: new URL(path, self.location.origin),
    request: { mode, headers: new Headers(marked ? { "X-Manejo-Offline-Page": "1" } : {}) } as Request,
  };
}

describe("navegação offline gerada", () => {
  it("aceita navegações e a preparação das telas essenciais sem iframe", () => {
    expect(navegacaoOffline(request("/rota-nao-salva"))).toBe(true);
    for (const path of PAGINAS_OFFLINE) {
      expect(navegacaoOffline(request(path, "cors", true))).toBe(true);
    }
  });
  it("não armazena OAuth, APIs, dados externos nem requisições comuns", () => {
    expect(navegacaoOffline(request("/~oauth/callback"))).toBe(false);
    expect(navegacaoOffline(request("/t/a5ef9bc0-9739-4d88-81fc-1ff25cf7df6a"))).toBe(false);
    expect(navegacaoOffline(request("/~oauth", "cors", true))).toBe(false);
    expect(navegacaoOffline(request("/api/private", "cors", true))).toBe(false);
    expect(navegacaoOffline(request("https://example.com/toras"))).toBe(false);
    expect(navegacaoOffline(request("/toras", "cors"))).toBe(false);
  });
  it("funciona serializada no worker sem referências ao módulo", () => {
    const callback = new Function(`return (${navegacaoOffline.toString()})`)() as typeof navegacaoOffline;
    expect(callback(request("/toras", "cors", true))).toBe(true);
    expect(callback(request("/~oauth"))).toBe(false);
    expect(callback(request("/t/a5ef9bc0-9739-4d88-81fc-1ff25cf7df6a"))).toBe(false);
  });
});
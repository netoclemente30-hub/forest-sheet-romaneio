// Shared by the generated worker and the browser's one-time document preparation.
export const PAGINAS_OFFLINE = ["/", "/toras", "/saldo", "/base", "/romaneio", "/serraria", "/entrada", "/etiquetas", "/historico"];

export function navegacaoOffline({ request, url }: { request: Request; url: URL }): boolean {
  // As fichas públicas devem consultar a situação ATUAL da serragem e nunca
  // receber HTML SSR antigo do cache NetworkFirst (nem fallback offline).
  if (url.origin !== self.location.origin || url.pathname.startsWith("/~oauth") || url.pathname.startsWith("/t/")) return false;
  return request.mode === "navigate" || (
    // generateSW serializes this callback: keep its allowlist self-contained.
    request.headers.get("X-Manejo-Offline-Page") === "1" &&
    ["/", "/toras", "/saldo", "/base", "/romaneio", "/serraria", "/entrada", "/etiquetas", "/historico"].includes(url.pathname)
  );
}
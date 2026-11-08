// Shared by the generated worker and the browser's one-time document preparation.
export const PAGINAS_OFFLINE = ["/", "/toras", "/saldo", "/base", "/romaneio", "/serraria", "/entrada", "/etiquetas", "/historico"];

export function navegacaoOffline({ request, url }: { request: Request; url: URL }): boolean {
  if (url.origin !== self.location.origin || url.pathname.startsWith("/~oauth")) return false;
  return request.mode === "navigate" || (
    request.headers.get("X-Manejo-Offline-Page") === "1" && PAGINAS_OFFLINE.includes(url.pathname)
  );
}
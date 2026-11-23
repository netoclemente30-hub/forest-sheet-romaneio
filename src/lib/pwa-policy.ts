// Shared by the generated worker and the browser's one-time document preparation.
export const PAGINAS_OFFLINE = ["/", "/toras", "/saldo", "/base", "/romaneio", "/serraria", "/entrada", "/etiquetas", "/historico", "/cortador", "/explanadas", "/relatorios", "/fiscal"];

export function navegacaoOffline({ request, url }: { request: Request; url: URL }): boolean {
  // As fichas públicas devem consultar a situação ATUAL da serragem e nunca
  // receber HTML SSR antigo do cache NetworkFirst (nem fallback offline).
  if (url.origin !== self.location.origin || url.pathname.startsWith("/~oauth") || url.pathname.startsWith("/t/") || url.pathname.startsWith("/api/") || url.pathname.startsWith("/lovable/")) return false;
  return request.mode === "navigate" || (
    // generateSW serializes this callback: keep its allowlist self-contained.
    request.headers.get("X-Manejo-Offline-Page") === "1" &&
    ["/", "/toras", "/saldo", "/base", "/romaneio", "/serraria", "/entrada", "/etiquetas", "/historico", "/cortador", "/explanadas", "/relatorios", "/fiscal"].includes(url.pathname)
  );
}
// Plugin of the generated worker's page cache. generateSW serializes these
// callbacks, so each one must stay self-contained (no outer references).
// 1) Never store/serve an HTML document whose /assets/ files are not all in
//    Cache Storage: after an update the old worker could save the NEW page
//    while its precache still holds the OLD chunks, and the offline reopen then
//    hydrated half the app and fell into the generic error screen.
// 2) Responses that followed a redirect (e.g. /etiquetas -> /etiquetas?p=) are
//    refused by the browser for navigations (ERR_FAILED); re-wrap them.
export const paginaOfflinePlugin = {
  cacheWillUpdate: async ({ response }: { response: Response }): Promise<Response | null> => {
    if (!response || response.status !== 200) return null;
    if (!(response.headers.get("content-type") || "").includes("text/html")) return null;
    const html = await response.clone().text();
    const refs = Array.from(new Set(html.match(/\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g) || []));
    if (refs.length === 0) return null;
    for (const ref of refs) if (!(await caches.match(ref))) return null;
    if (!response.redirected) return response;
    return new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
  },
  cachedResponseWillBeUsed: async ({ cachedResponse }: { cachedResponse?: Response | null }): Promise<Response | null> => {
    if (!cachedResponse) return null;
    const html = await cachedResponse.clone().text();
    const refs = Array.from(new Set(html.match(/\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g) || []));
    if (refs.length === 0) return null;
    for (const ref of refs) if (!(await caches.match(ref))) return null;
    if (!cachedResponse.redirected) return cachedResponse;
    return new Response(html, { status: cachedResponse.status, statusText: cachedResponse.statusText, headers: cachedResponse.headers });
  },
};

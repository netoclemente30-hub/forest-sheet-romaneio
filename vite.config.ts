// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        injectRegister: null, // o registro é só pelo wrapper src/lib/pwa-register.ts
        devOptions: { enabled: false }, // nunca emite SW em dev
        filename: "sw.js",
        manifest: false, // manifesto servido de public/manifest.webmanifest
        workbox: {
          // O build SSR é examinado a partir do diretório pai, mas a hospedagem
          // serve client/ na raiz. Não precachear URLs /client/assets inexistentes.
          modifyURLPrefix: { "client/": "" },
           globPatterns: ["**/*.{js,css,woff2,png,webmanifest}", "**/offline.html"],
          globIgnores: ["**/server/**", "**/sw.js", "**/workbox-*.js"],
           clientsClaim: true,
           skipWaiting: true,
           // NavigationRoute de navigateFallback precede runtimeCaching e
           // substituiria TODAS as páginas. Usar PrecacheFallbackPlugin apenas
           // quando NetworkFirst não encontra rede nem a página salva.
          navigateFallback: null,
           navigateFallbackDenylist: [/^\/~oauth/],
          runtimeCaching: [
            {
              // Navegações/HTML: rede primeiro, nunca cache-first
               urlPattern: ({ request, url }: { request: Request; url: URL }) =>
                 url.origin === self.location.origin && !url.pathname.startsWith("/~oauth") &&
                 (request.mode === "navigate" || (request.headers.get("X-Manejo-Offline-Page") === "1" &&
                   ["/", "/toras", "/saldo", "/base", "/romaneio", "/serraria", "/entrada", "/etiquetas", "/historico"].includes(url.pathname))),
              handler: "NetworkFirst",
               options: {
                 cacheName: "paginas",
                 networkTimeoutSeconds: 3,
                 cacheableResponse: { statuses: [200] },
                 precacheFallback: { fallbackURL: "/offline.html" },
               },
            },
            {
              // Assets com hash same-origin: cache-first
              urlPattern: ({ url, request }: { url: URL; request: Request }) =>
                url.origin === self.location.origin && request.destination !== "document" && /\/assets\//.test(url.pathname),
              handler: "CacheFirst",
              options: { cacheName: "assets" },
            },
          ],
        },
      }),
    ],
  },
});

// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import { loadEnv } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { navegacaoOffline } from "./src/lib/pwa-policy";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Variáveis de servidor (sem prefixo VITE_) só em process.env; nunca no bundle do cliente.
Object.assign(process.env, loadEnv(process.env['NODE_ENV'] ?? "development", process.cwd(), ""));

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: [
        { find: "entities/lib/decode.js", replacement: path.resolve(__dirname, "node_modules/entities/lib/decode.js") },
        { find: "entities/lib/encode.js", replacement: path.resolve(__dirname, "node_modules/entities/lib/encode.js") },
        { find: /^entities$/, replacement: path.resolve(__dirname, "node_modules/entities") },
      ],
    },
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
               urlPattern: navegacaoOffline,
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

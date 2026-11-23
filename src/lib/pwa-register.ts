// Registro do service worker de offline (/sw.js gerado pelo vite-plugin-pwa).
// NUNCA registra em dev nem nos previews da Lovable — SW em preview serve HTML/chunks velhos.
// Chamar apenas a partir de useEffect (browser-only).
import { PAGINAS_OFFLINE } from "./pwa-policy";

const PREVIEW_LABEL = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/;
const PREVIEW_HOSTS = ["lovable.app", "gpt-eng.com", "gptengineer.run"];

 export function hostnameBloqueado(hostname: string): boolean {
  const h = hostname.toLowerCase();
  for (const base of PREVIEW_HOSTS) {
    if (h === base || !h.endsWith(`.${base}`)) continue;
    const label = h.slice(0, h.length - base.length - 1).split(".")[0] ?? "";
    if (PREVIEW_LABEL.test(label)) return true;
    if (/^live--[0-9a-f-]{36}(?:-thr_[a-z0-9]+)?$/.test(label)) return true;
    if (/^project--.+-dev$/.test(label)) return true;
  }
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  return false;
}

function contextoRecusado(): boolean {
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true; // iframe (preview do editor)
  if (hostnameBloqueado(window.location.hostname)) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function desregistrarAntigos() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) => r.active?.scriptURL.endsWith("/sw.js") || r.installing?.scriptURL.endsWith("/sw.js") || r.waiting?.scriptURL.endsWith("/sw.js"))
      .map((r) => r.unregister()),
  );
}

export async function registrarServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (contextoRecusado()) {
    await desregistrarAntigos();
    return;
  }
  try {
     await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
     await navigator.serviceWorker.ready;
      // Esperar clientsClaim antes de preparar documentos pelo NetworkFirst.
     if (!navigator.serviceWorker.controller) {
       await new Promise<void>((resolve) => {
         const concluir = () => {
           window.clearTimeout(timer);
           navigator.serviceWorker.removeEventListener("controllerchange", concluir);
           resolve();
         };
         const timer = window.setTimeout(concluir, 10000);
         navigator.serviceWorker.addEventListener("controllerchange", concluir);
         if (navigator.serviceWorker.controller) concluir();
       });
     }
     // A new worker taking over (update) re-prepares pages for ITS precache.
     navigator.serviceWorker.addEventListener("controllerchange", () => { void prepararPaginas(); });
     await prepararPaginas();
  } catch {
    // falha de registro não pode quebrar o app
  }
}

let preparando: Promise<void> | null = null;
function prepararPaginas(): Promise<void> {
  preparando ??= (async () => {
     if (navigator.serviceWorker.controller && navigator.onLine) {
        // Requisições sequenciais de HTML (sem renderizar outro app/iframe).
        // O worker gerado é quem grava paginas; assets/fallback são precacheados
        // na instalação. Dados privados continuam no IndexedDB por empresa.
        for (const url of PAGINAS_OFFLINE) {
          if (!navigator.onLine) break;
          try {
            await fetch(url, {
              headers: { "X-Manejo-Offline-Page": "1" },
              credentials: "same-origin",
              signal: AbortSignal.timeout(10000),
            });
          } catch {
            // Uma página indisponível não impede preparar as demais.
          }
        }
     }
  })().finally(() => { preparando = null; });
  return preparando;
}

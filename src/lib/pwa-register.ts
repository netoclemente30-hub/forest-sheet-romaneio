// Registro do service worker de offline (/sw.js gerado pelo vite-plugin-pwa).
// NUNCA registra em dev nem nos previews da Lovable — SW em preview serve HTML/chunks velhos.
// Chamar apenas a partir de useEffect (browser-only).

const PREVIEW_LABEL = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/;
const PREVIEW_HOSTS = ["lovable.app", "gpt-eng.com", "gptengineer.run"];

function hostnameBloqueado(hostname: string): boolean {
  const h = hostname.toLowerCase();
  for (const base of PREVIEW_HOSTS) {
    if (h === base || !h.endsWith(`.${base}`)) continue;
    const label = h.slice(0, h.length - base.length - 1).split(".")[0] ?? "";
    if (PREVIEW_LABEL.test(label)) return true;
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
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    // falha de registro não pode quebrar o app
  }
}

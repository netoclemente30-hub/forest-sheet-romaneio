// Empresa que o administrador geral (superadmin) está visualizando no momento.
// Guardada no navegador; vazia = visão padrão (própria empresa / todas).
const KEY = "empresa_ativa";
export const EVENTO_EMPRESA = "empresa-ativa-changed";

export function getEmpresaAtiva(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setEmpresaAtiva(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(KEY, id);
  else window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENTO_EMPRESA));
}

/** empresa_id para gravar novos registros quando o superadmin está vendo outra empresa. */
export function empresaIdGravacao(): { empresa_id: string } | Record<string, never> {
  const id = getEmpresaAtiva();
  return id ? { empresa_id: id } : {};
}

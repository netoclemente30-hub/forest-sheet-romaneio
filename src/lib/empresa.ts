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

// Vínculo já confirmado pela nuvem, separado por usuário para reabrir o app sem rede.
export function lerEmpresaSalva(usuario: string | null | undefined): string | null {
  if (!usuario || typeof window === "undefined") return null;
  try { return window.localStorage.getItem(`encaixe-empresa:${usuario}`); }
  catch { return null; }
}

export function salvarEmpresaDoUsuario(usuario: string, empresa: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(`encaixe-empresa:${usuario}`, empresa); }
  catch { /* o vínculo online continua disponível */ }
}

/** empresa_id para gravar novos registros quando o superadmin está vendo outra empresa. */
export function empresaIdGravacao(): { empresa_id: string } | Record<string, never> {
  const id = getEmpresaAtiva();
  return id ? { empresa_id: id } : {};
}

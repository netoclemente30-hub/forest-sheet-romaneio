import { funcaoValida, type FuncaoFuncionario } from '@/lib/funcoes';
export type PermissoesSalvas = { usuario: string; empresa: string; admin: boolean; superadmin: boolean; funcao: FuncaoFuncionario | null; validadoEm: number };
const prefixo = 'permissoes-validadas-v2:';
export function lerPermissoes(usuario: string, empresa: string | null): PermissoesSalvas | null {
  if (!empresa) return null;
  try {
    const p = JSON.parse(localStorage.getItem(`${prefixo}${usuario}:${empresa}`) ?? 'null') as PermissoesSalvas | null;
    if (!p || p.usuario !== usuario || p.empresa !== empresa || typeof p.validadoEm !== 'number' || !Number.isFinite(p.validadoEm) || p.validadoEm <= 0 || typeof p.admin !== 'boolean' || typeof p.superadmin !== 'boolean' || (p.funcao !== null && !funcaoValida(p.funcao))) return null;
    return p;
  } catch { return null; }
}
export function salvarPermissoes(p: PermissoesSalvas) {
  try { localStorage.setItem(`${prefixo}${p.usuario}:${p.empresa}`, JSON.stringify(p)); } catch { /* online remains usable; no offline guarantee */ }
}
export function invalidarPermissoes(usuario: string) {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(`${prefixo}${usuario}:`)) localStorage.removeItem(key);
    localStorage.removeItem(`permissoes-offline:${usuario}`);
    localStorage.removeItem(`encaixe-empresa:${usuario}`);
  } catch { /* unavailable storage fails closed */ }
}

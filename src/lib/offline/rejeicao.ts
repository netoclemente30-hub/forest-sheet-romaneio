import { erroDeRede } from './conexao';
/** Only explicit rollback replies can unlock changes to a previously sent payload. */
export function rejeicaoConfirmada(e: unknown): boolean {
  if (erroDeRede(e)) return false;
  const code = (e as { code?: string } | null)?.code ?? '';
  return /^(22|23)/.test(code) || ['P0001', '42501'].includes(code);
}
export function erroDaTransacao(e: { message: string; code?: string }) {
  return Object.assign(new Error(e.message), e.code ? { code: e.code } : {});
}

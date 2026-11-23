import { erroDeRede } from './conexao';

/** A PostgreSQL error returned by an atomic mutation: its transaction rolled back. */
export class RejeicaoConfirmada extends Error {
  code?: string;
}

/** Only explicit rollback replies can unlock changes to a previously sent payload. */
export function rejeicaoConfirmada(e: unknown): boolean {
  if (e instanceof RejeicaoConfirmada) return true;
  if (erroDeRede(e)) return false;
  const code = (e as { code?: string } | null)?.code ?? '';
  return /^(22|23)/.test(code) || ['P0001', '42501'].includes(code);
}

export function erroDaTransacao(e: { message: string; code?: string }): Error {
  // Never infer rollback from timeout/network text or a generic HTTP failure.
  const erro = /^(22|23)|^P0001$|^42501$/.test(e.code ?? '') ? new RejeicaoConfirmada(e.message) : new Error(e.message);
  return Object.assign(erro, e.code ? { code: e.code } : {});
}

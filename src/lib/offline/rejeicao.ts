/** A PostgreSQL error returned by an atomic mutation: its transaction rolled back. */
export class RejeicaoConfirmada extends Error {}

export function erroDaTransacao(erro: { code?: string; message: string }): Error {
  // Never infer rollback from timeout/network text or a generic HTTP failure.
  return /^(22|23)|^P0001$|^42501$/.test(erro.code ?? '')
    ? new RejeicaoConfirmada(erro.message)
    : new Error(erro.message);
}
import { fila, type Fila, type Op } from './fila';

/** Acknowledges durable local intent, never remote confirmation. */
export async function persistirOperacao(op: Op, f: Fila = fila()) {
  return f.enfileirar(op);
}
import { describe, expect, it, vi } from 'vitest';
import { transacionar } from './db';

function banco() {
  const request = { result: 42, error: null, onsuccess: null as null | (() => void), onerror: null as null | (() => void) };
  const transaction = { error: null, oncomplete: null as null | (() => void), onabort: null as null | (() => void), onerror: null as null | (() => void), objectStore: () => ({}), abort: vi.fn() };
  const db = { transaction: vi.fn(() => transaction), close: vi.fn() };
  return { request, transaction, db, start: () => transacionar(db as unknown as IDBDatabase, 'fila', 'readwrite', () => request as unknown as IDBRequest<number>) };
}
describe('durabilidade IndexedDB', () => {
  it('não confirma request success antes do commit da transação', async () => {
    const b = banco(); let confirmado = false;
    const p = b.start().then(v => { confirmado = true; return v; });
    b.request.onsuccess?.();
    await Promise.resolve();
    expect(confirmado).toBe(false);
    b.transaction.oncomplete?.();
    expect(await p).toBe(42);
    expect(b.db.close).toHaveBeenCalledTimes(1);
  });
  it('abort após success rejeita sem confirmar persistência', async () => {
    const b = banco(); const p = b.start();
    b.request.onsuccess?.(); b.transaction.onabort?.();
    await expect(p).rejects.toThrow('interrompida');
    expect(b.db.close).toHaveBeenCalledTimes(1);
  });
  it('erro ao abrir transação fecha conexão e rejeita', async () => {
    const b = banco(); b.db.transaction.mockImplementation(() => { throw new Error('QuotaExceededError'); });
    await expect(b.start()).rejects.toThrow('QuotaExceededError');
    expect(b.db.close).toHaveBeenCalledTimes(1);
  });
});
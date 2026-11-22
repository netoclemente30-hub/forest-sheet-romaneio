import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { idb } from './db';

beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('grava e relê uma operação depois de fechar a conexão IndexedDB', async () => {
  await idb.put('fila', { id: '39A', empresa: 'RJ', volume: 1.5 });
  expect(await idb.get('fila', '39A')).toEqual({ id: '39A', empresa: 'RJ', volume: 1.5 });
});
it('só resolve depois de transaction.oncomplete, nunca em request.onsuccess', async () => {
  const req = {} as IDBRequest<IDBValidKey>;
  const transaction = { objectStore: () => ({ put: () => req }), oncomplete: undefined as undefined | (() => void), onabort: undefined as undefined | (() => void), error: null };
  const db = { transaction: () => transaction, close: vi.fn() };
  const open = { result: db, onsuccess: undefined as undefined | (() => void) };
  vi.stubGlobal('indexedDB', { open: () => open });
  let concluida = false;
  const p = idb.put('fila', { id: '39A' }).then(() => { concluida = true; });
  open.onsuccess?.(); await Promise.resolve();
  req.onsuccess?.call(req, new Event('success'));
  await Promise.resolve(); expect(concluida).toBe(false);
  transaction.oncomplete?.(); await p; expect(concluida).toBe(true);
});
it('request bem sucedido seguido de abort/quota rejeita sem informar salvo', async () => {
  const req = {} as IDBRequest<IDBValidKey>;
  const transaction = { objectStore: () => ({ put: () => req }), oncomplete: undefined as undefined | (() => void), onabort: undefined as undefined | (() => void), error: new DOMException('quota', 'QuotaExceededError') };
  const open = { result: { transaction: () => transaction, close: vi.fn() }, onsuccess: undefined as undefined | (() => void) };
  vi.stubGlobal('indexedDB', { open: () => open });
  const p = idb.put('fila', { id: '39A' });
  open.onsuccess?.(); await Promise.resolve();
  req.onsuccess?.call(req, new Event('success')); transaction.onabort?.();
  await expect(p).rejects.toThrow('NÃO foi salvo');
});
it('armazenamento indisponível não promete salvamento offline', async () => {
  vi.stubGlobal('indexedDB', undefined);
  await expect(idb.put('fila', { id: '39A' })).rejects.toThrow('não foi salvo');
});

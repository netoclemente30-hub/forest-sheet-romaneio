import { beforeEach, expect, it, vi } from 'vitest';
import { excluirRascunho } from './rascunho';

const mocks = vi.hoisted(() => ({
  usuario: 'neto', empresa: 'rone', del: vi.fn(),
}));
vi.mock('./db', () => ({ idb: { del: mocks.del } }));
vi.mock('@/lib/empresa', () => ({
  getEmpresaAtiva: () => mocks.empresa,
  lerEmpresaSalva: () => null,
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {
  getSession: async () => ({ data: { session: { user: { id: mocks.usuario } } }, error: null }),
} } }));
beforeEach(() => { mocks.usuario = 'neto'; mocks.empresa = 'rone'; mocks.del.mockReset(); });

it('exclui somente a ficha do usuário e empresa ativos', async () => {
  await excluirRascunho('ficha-importacao');
  expect(mocks.del).toHaveBeenCalledExactlyOnceWith('cache', 'rascunho:neto:rone:ficha-importacao');
  mocks.usuario = 'operador'; mocks.empresa = 'rms';
  await excluirRascunho('ficha-importacao');
  expect(mocks.del).toHaveBeenLastCalledWith('cache', 'rascunho:operador:rms:ficha-importacao');
});

it('aguarda a exclusão persistente antes de concluir', async () => {
  let concluir: (() => void) | undefined;
  mocks.del.mockImplementation(() => new Promise<void>(resolve => { concluir = resolve; }));
  let terminado = false;
  const operacao = excluirRascunho('ficha-importacao').then(() => { terminado = true; });
  await Promise.resolve(); await Promise.resolve();
  expect(terminado).toBe(false);
  expect(concluir).toBeTypeOf('function');
  concluir?.();
  await operacao;
  expect(terminado).toBe(true);
});

it('não confirma descarte quando a exclusão falha', async () => {
  mocks.del.mockRejectedValue(new Error('falha de armazenamento'));
  await expect(excluirRascunho('ficha-importacao')).rejects.toThrow('falha de armazenamento');
});
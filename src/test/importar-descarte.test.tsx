import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route } from '@/routes/importar';

const mocks = vi.hoisted(() => ({
  rascunho: null as unknown, excluir: vi.fn(), rpc: vi.fn(), nav: vi.fn(),
}));
vi.mock('@tanstack/react-router', async importOriginal => ({
  ...await importOriginal<typeof import('@tanstack/react-router')>(), useNavigate: () => mocks.nav,
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ isAdmin: true, isSuperAdmin: false, loading: false, permissoesCarregando: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/lib/offline/rascunho', () => ({
  lerRascunho: async () => mocks.rascunho,
  guardarRascunho: vi.fn(), excluirRascunho: mocks.excluir,
  contextoLocal: async () => ({ usuario: 'neto', empresa: 'rone' }),
}));
beforeEach(() => {
  mocks.rpc.mockReset(); mocks.excluir.mockReset();
  mocks.rascunho = { preparado: { arquivo: 'ficha.xlsx', arvores: [{ numero: 39, autex: '41234', nome_vulgar: 'Jatobá' }], calc: [], invalidas: 0, repetidas: 0 }, autexPadrao: '41234' };
  mocks.excluir.mockImplementation(async () => { mocks.rascunho = null; });
});
afterEach(cleanup);
function abrir() {
  const Component = Route.options.component;
  if (!Component) throw new Error('Tela ausente');
  return render(<QueryClientProvider client={new QueryClient()}><Component /></QueryClientProvider>);
}
it('descarta sem importar e não restaura a ficha ao reabrir', async () => {
  const tela = abrir();
  const botao = await screen.findByRole('button', { name: 'Descartar ficha' });
  await waitFor(() => expect(botao).toBeEnabled());
  fireEvent.click(botao);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirmar importação' })).toBeNull());
  expect(mocks.excluir).toHaveBeenCalledExactlyOnceWith('ficha-importacao');
  expect(mocks.rpc).not.toHaveBeenCalled();
  tela.unmount(); abrir();
  await waitFor(() => expect(screen.getByLabelText('Importar ficha de campo')).toBeEnabled());
  expect(screen.queryByRole('button', { name: 'Confirmar importação' })).toBeNull();
});
it('mantém a ficha e permite tentar novamente quando o descarte falha', async () => {
  mocks.excluir.mockRejectedValue(new Error('falha'));
  abrir();
  const botao = await screen.findByRole('button', { name: 'Descartar ficha' });
  await waitFor(() => expect(botao).toBeEnabled());
  fireEvent.click(botao);
  await waitFor(() => expect(mocks.excluir).toHaveBeenCalledOnce());
  await waitFor(() => expect(botao).toBeEnabled());
  expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeEnabled();
  expect(mocks.rascunho).not.toBeNull();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
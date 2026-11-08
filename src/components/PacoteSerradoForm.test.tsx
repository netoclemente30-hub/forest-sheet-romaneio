import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { PacoteSerradoForm } from './PacoteSerradoForm';
const mocks=vi.hoisted(()=>({salvar:vi.fn().mockResolvedValue(undefined)}));
afterEach(()=>{cleanup();mocks.salvar.mockClear();});
vi.mock('@/lib/madeira-serrada',async importOriginal=>({...await importOriginal<typeof import('@/lib/madeira-serrada')>(),salvarPacote:mocks.salvar,autexSerradasQuery:()=>({queryKey:['test-autex'],queryFn:async()=>[{numero:'CADASTRADA-123'}]})}));
it('salva AUTEX livre sem exigir toras ou pacotes existentes e aceita três bitolas',async()=>{
  render(<QueryClientProvider client={new QueryClient()}><PacoteSerradoForm empresa="empresa" pacotes={[]} onSalvo={()=>{}} onCancelar={()=>{}}/></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('Número do pacote'),{target:{value:'25'}});
  fireEvent.change(screen.getByLabelText('Espécie padrão'),{target:{value:'Cupiúba'}});
  fireEvent.change(screen.getByLabelText('AUTEX do pacote'),{target:{value:'AUTEX-NOVA-LIVRE'}});
  fireEvent.change(screen.getByLabelText('Peças 1.0m bitola 1'),{target:{value:'1'}});
  for(const index of [2,3]){fireEvent.click(screen.getByRole('button',{name:'Adicionar Bitola no Pacote'}));fireEvent.change(screen.getByLabelText(`Peças 1.0m bitola ${index}`),{target:{value:'1'}});}
  await act(async()=>{fireEvent.submit(screen.getByRole('button',{name:'Salvar pacote'}).closest('form') as HTMLFormElement);});
  await vi.waitFor(()=>expect(mocks.salvar).toHaveBeenCalled());
  expect(mocks.salvar.mock.calls[0]?.[2]).toEqual(expect.objectContaining({autex:'AUTEX-NOVA-LIVRE',numero:'25'}));
  expect(mocks.salvar.mock.calls[0]?.[3]).toHaveLength(3);
});
it('prefill das toras exige confirmar AUTEX e permite alterá-la',async()=>{
 render(<QueryClientProvider client={new QueryClient()}><PacoteSerradoForm empresa="empresa" pacotes={[]} sugestao={{especie:'Cupiúba',autex:'123',plaquetas:[1,2]}} onSalvo={()=>{}} onCancelar={()=>{}}/></QueryClientProvider>);
 expect(screen.getByLabelText('Espécie padrão')).toHaveValue('Cupiúba');expect(screen.getByLabelText('AUTEX do pacote')).toHaveValue('123');
 fireEvent.change(screen.getByLabelText('Número do pacote'),{target:{value:'26'}});fireEvent.change(screen.getByLabelText('Peças 1.0m bitola 1'),{target:{value:'1'}});
 await act(async()=>{fireEvent.submit(screen.getByRole('button',{name:'Salvar pacote'}).closest('form') as HTMLFormElement);});
 expect(mocks.salvar).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Confirmar AUTEX sugerida'}));
 fireEvent.change(screen.getByLabelText('AUTEX do pacote'),{target:{value:'ALTERADA'}});
 await act(async()=>{fireEvent.submit(screen.getByRole('button',{name:'Salvar pacote'}).closest('form') as HTMLFormElement);});
 expect(mocks.salvar).toHaveBeenCalledWith('empresa',expect.any(String),expect.objectContaining({autex:'ALTERADA'}),expect.any(Array));
});
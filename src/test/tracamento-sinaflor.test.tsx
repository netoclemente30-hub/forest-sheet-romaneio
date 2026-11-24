import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SinaflorCsvExportacao } from '@/components/SinaflorCsvExportacao';
import type { Tora } from '@/lib/data';

const mocks = vi.hoisted(() => ({salvar:vi.fn(),listar:vi.fn(),erro:vi.fn()}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({empresaId:'empresa',isSuperAdmin:false,session:{user:{id:'usuario'}}})}));
vi.mock('@/lib/empresa',()=>({getEmpresaAtiva:()=>null}));
vi.mock('@/lib/arquivo',()=>({salvarArquivo:mocks.salvar}));
vi.mock('@/lib/offline/fila',()=>({fila:()=>({listar:mocks.listar})}));
vi.mock('sonner',()=>({toast:{error:mocks.erro,success:vi.fn()}}));

const tora = {empresa_id:'empresa',autex:'AUTEX 123',origem:'manejo',arvore:7477,secao:'A',plaqueta:3,d_topo1:72,d_topo2:74,d_pe1:56,d_pe2:57,comprimento:5.1,created_at:new Date().toISOString()} as Tora;
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();mocks.listar.mockResolvedValue([]);mocks.salvar.mockResolvedValue(undefined);});

it('mostra o lançamento na prévia, seleciona a única AUTEX e baixa o layout de cinco colunas',async()=>{
  render(<SinaflorCsvExportacao arvores={[]} toras={[tora]} apenasTracadas />);
  await waitFor(()=>expect(screen.getByLabelText('AUTEX para exportação SINAFLOR')).toHaveValue('AUTEX 123'));
  expect(screen.getByText('7477')).toBeInTheDocument();
  expect(screen.getByText('0,73')).toBeInTheDocument();
  expect(screen.getByText('0,565')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/CSV árvores abatidas/})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Traçar SINAFLOR (1 toras)'}));
  await waitFor(()=>expect(mocks.salvar).toHaveBeenCalledTimes(1));
  const {blob} = mocks.salvar.mock.calls[0]![0];
  const texto = await new Promise<string>(resolve=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.readAsText(blob);});
  expect(texto).toBe('Nº Árvore;Secção;Diâmetro 1 (m);Diâmetro 2 (m);Comprimento (m)\r\n7477;A;0,73;0,565;5,1\r\n');
});

it('mostra a tora local imediatamente na prévia e exige sincronização antes do CSV final',async()=>{
  mocks.listar.mockResolvedValue([{op:{tipo:'tora_insert',dados:{empresa_id:'empresa',autex:'AUTEX 123'}}}]);
  render(<SinaflorCsvExportacao arvores={[]} toras={[tora]} apenasTracadas />);
  fireEvent.click(await screen.findByRole('button',{name:'Traçar SINAFLOR (1 toras)'}));
  await waitFor(()=>expect(mocks.erro).toHaveBeenCalledWith(expect.stringContaining('Sincronize antes')));
  expect(mocks.salvar).not.toHaveBeenCalled();
  expect(screen.getByText('7477')).toBeInTheDocument();
});

it('traçamento de toras sincronizadas não depende de pendências do cortador',async()=>{
  mocks.listar.mockResolvedValue([{op:{tipo:'arvore_gps',empresa_id:'empresa',autex:'AUTEX 123'}}]);
  render(<SinaflorCsvExportacao arvores={[]} toras={[tora]} apenasTracadas />);
  fireEvent.click(await screen.findByRole('button',{name:'Traçar SINAFLOR (1 toras)'}));
  await waitFor(()=>expect(mocks.salvar).toHaveBeenCalledTimes(1));
  expect(mocks.erro).not.toHaveBeenCalled();
});

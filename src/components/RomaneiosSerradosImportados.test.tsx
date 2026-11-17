import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { RomaneiosSerradosImportados } from './RomaneiosSerradosImportados';
const mocks=vi.hoisted(()=>({salvar:vi.fn().mockResolvedValue(2)}));
const fixture={id:'documento-estavel',empresa_id:'empresa-A',revisao:1,total_pecas:2,total_volume_m3:0.0548,cab:{numero_carga:'JAIR7',data:'2026-11-17',cliente_nome:'Cliente',cliente_documento:'',motorista_nome:'',motorista_cpf:'',placa_veiculo:'',placa_reboque:'',observacoes:''},itens:[{id:'peca-estavel',especie:'MIRINDIBA',nome_cientifico:'Original',autex:'A',tipo_peca:'Tábua',grossura:2.5,largura:15,comprimento:7.3,quantidade:2}]};
vi.mock('@/lib/romaneio-serrado-importado',()=>({salvarImportado:mocks.salvar,importadosQuery:(empresa:string)=>({queryKey:['importados',empresa],queryFn:async()=>[fixture]})}));
vi.mock('@/lib/madeira-serrada',()=>({autexSerradasQuery:()=>({queryKey:['autex'],queryFn:async()=>[]})}));
afterEach(()=>{cleanup();mocks.salvar.mockClear();});
function abrir(empresa='empresa-A',podeOperar=true){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><RomaneiosSerradosImportados empresa={empresa} podeOperar={podeOperar} q=""/></QueryClientProvider>);}
it('edita peça, nome científico e AUTEX livre preservando documento, peça, empresa e revisão',async()=>{
 abrir();fireEvent.click(await screen.findByRole('button',{name:'Editar romaneio'}));
 expect(screen.getByLabelText('Comprimento (m) peças 1')).toHaveValue(7.3);
 fireEvent.change(screen.getByLabelText('Nome científico peças 1'),{target:{value:'Novo nome'}});
 fireEvent.change(screen.getByLabelText('AUTEX peças 1'),{target:{value:'MANUAL'}});
 fireEvent.change(screen.getByLabelText('Quantidade peças 1'),{target:{value:'4'}});
 fireEvent.click(screen.getByRole('button',{name:'Adicionar peças'}));
 await act(async()=>{fireEvent.submit(screen.getByRole('button',{name:'Salvar romaneio importado'}).closest('form') as HTMLFormElement);});
 await vi.waitFor(()=>expect(mocks.salvar).toHaveBeenCalledTimes(1));
 expect(mocks.salvar).toHaveBeenCalledWith('empresa-A','documento-estavel',1,fixture.cab,expect.arrayContaining([expect.objectContaining({id:'peca-estavel',nome_cientifico:'Novo nome',autex:'MANUAL',quantidade:4,comprimento:7.3})]),expect.any(String));
 expect(mocks.salvar.mock.calls[0]?.[4]).toHaveLength(2);
 expect(fixture.itens[0]?.quantidade).toBe(2);
});
it('cancelar não escreve nem modifica o documento original',async()=>{abrir();fireEvent.click(await screen.findByRole('button',{name:'Editar romaneio'}));fireEvent.change(screen.getByLabelText('Quantidade peças 1'),{target:{value:'20'}});fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));expect(mocks.salvar).not.toHaveBeenCalled();expect(fixture.itens[0]?.quantidade).toBe(2);});
it('não apresenta documento de outra empresa mesmo se a resposta contiver o registro',async()=>{abrir('empresa-B');await vi.waitFor(()=>expect(screen.queryByText('Carregando romaneios importados…')).not.toBeInTheDocument());expect(screen.queryByRole('button',{name:'Editar romaneio'})).not.toBeInTheDocument();expect(screen.queryByText('JAIR7')).not.toBeInTheDocument();});
it('consulta sem operação não oferece importação ou edição',async()=>{abrir('empresa-A',false);await screen.findByText('JAIR7');expect(screen.queryByRole('button',{name:'Editar romaneio'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Importar romaneio'})).not.toBeInTheDocument();});
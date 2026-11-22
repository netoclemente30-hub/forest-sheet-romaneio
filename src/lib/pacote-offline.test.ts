import { expect,it,vi } from 'vitest';
import { criarFila,type ItemFila } from './offline/fila';
import { executarOp,sincronizar } from './offline/sync';
import { pacotesComFila } from './madeira-serrada';
const rpc=vi.hoisted(()=>vi.fn().mockResolvedValue({error:null}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc}}));
it('preserva pacote, empresa e auditoria ao editar e sincronizar offline',async()=>{
 const rows=new Map<string,ItemFila>();
 const f=criarFila({all:async()=>[...rows.values()],put:async i=>{rows.set(i.id,i);},del:async id=>{rows.delete(id);}});
 const item=await f.enfileirar({tipo:'pacote_serrado_salvar',empresa_id:'empresa',pacote_id:'pacote',cab:{numero:'25',autex:'123',data:'2026-11-08',observacoes:''},itens:[{especie:'Cupiúba',tipo_peca:'Viga',grossura:5,largura:15,distribuicao_pecas:{'6.0':10}}],log:{operacao_id:'audit',acao:'Pacote',detalhe:'25',user_email:null,lat:1,lng:2,criado_em:'2026-11-08T23:00:00Z'}});
 if(item.op.tipo!=='pacote_serrado_salvar')throw new Error('op inválida');
 await f.atualizarPacote(item.id,{...item.op,cab:{...item.op.cab,autex:'ALTERADA'}});
 const projected=pacotesComFila([],await f.listar(),'empresa');
 expect(projected[0]?.autex).toBe('ALTERADA');expect(projected[0]?.itens[0]?.volume_m3).toBe(0.45);
 expect(pacotesComFila([],await f.listar(),'outra')).toEqual([]);
 await sincronizar(f,executarOp,async()=>true);
 expect(rpc).toHaveBeenCalledWith('salvar_pacote_serrado',expect.objectContaining({_empresa:'empresa',_id:'pacote',_log:expect.objectContaining({operacao_id:'audit',lat:1,lng:2})}));
 expect(await f.listar()).toEqual([]);
});
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { capturarLog } from './registro';
import { comCache } from './offline/cache';
import { validarImportado, type CabImportado, type PecaImportada } from './romaneio-serrado-importar';
import { guardarRascunho } from './offline/rascunho';
import { fila } from './offline/fila';

export type RomaneioImportado = {id:string;empresa_id:string;cab:CabImportado;itens:PecaImportada[];revisao:number;total_pecas:number;total_volume_m3:number};
export function importadosQuery(empresa:string) {
  return {queryKey:['romaneios-serrados-importados',empresa],networkMode:'always' as const,queryFn:()=>comCache<RomaneioImportado>(`romaneios-serrados-importados:${empresa}`,async()=>{
    const rows:RomaneioImportado[]=[];
    for(let from=0;;from+=500) {
      const {data,error}=await supabase.from('romaneios_serrados_importados').select('*').eq('empresa_id',empresa).order('atualizado_em',{ascending:false}).order('id').range(from,from+499);
      if(error)throw new Error(error.message);
      rows.push(...(data??[]).map(r=>({...r,cab:r.cab as unknown as CabImportado,itens:r.itens as unknown as PecaImportada[]})));
      if((data?.length??0)<500)return rows;
    }
  }, empresa)};
}
export async function salvarImportado(empresa:string,id:string,revisao:number,cab:CabImportado,itens:PecaImportada[],operacao:string) {
  validarImportado(cab,itens);
  await guardarRascunho(`romaneio-importado:${id}`, { id, revisao, cab, itens, operacao, confirmado: false }, empresa);
  const log=await capturarLog(revisao?'Romaneio importado editado':'Romaneio serrado importado',cab.numero_carga);
  const f = fila();
  const pendente = (await f.listar()).find(i => i.op.tipo === 'romaneio_importado_salvar' && i.op.documento_id === id && i.op.empresa_id === empresa);
  const op = { tipo: 'romaneio_importado_salvar' as const, empresa_id: empresa, documento_id: id, revisao, cab, itens, operacao, log };
  if (pendente) {
    if (pendente.envio_iniciado) throw new Error('O envio deste romaneio já começou. Aguarde confirmação antes de editar.');
    await f.substituir(pendente.id, op);
    return pendente;
  }
  return f.enfileirar(op);
}
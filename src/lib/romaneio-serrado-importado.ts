import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { capturarLog } from './registro';
import { comCache } from './offline/cache';
import { validarImportado, type CabImportado, type PecaImportada } from './romaneio-serrado-importar';

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
  })};
}
export async function salvarImportado(empresa:string,id:string,revisao:number,cab:CabImportado,itens:PecaImportada[],operacao:string) {
  validarImportado(cab,itens);
  if(!navigator.onLine)throw new Error('Conecte à internet para salvar este romaneio. Os dados continuam na tela.');
  const log=await capturarLog(revisao?'Romaneio importado editado':'Romaneio serrado importado',cab.numero_carga);
  const {data,error}=await supabase.rpc('salvar_romaneio_serrado_importado',{_empresa:empresa,_id:id,_revisao:revisao,_cab:cab as unknown as Json,_itens:itens as unknown as Json,_operacao:operacao,_log:log as unknown as Json});
  if(error)throw new Error(error.message);
  return data;
}
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { PacoteSerradoForm } from './PacoteSerradoForm';
import { madeiraQuery } from '@/lib/madeira-serrada';
import type { SugestaoPacote } from '@/lib/pacote-de-toras';

export function PacoteDeToras({empresa,grupos,onFechar,onSalvo}:{empresa:string;grupos:SugestaoPacote[];onFechar:()=>void;onSalvo:()=>void}) {
  const [escolha,setEscolha]=useState<SugestaoPacote|undefined>(()=>grupos.length===1?grupos[0]:undefined);
  const pacotes=useQuery(madeiraQuery(empresa));
  const qc=useQueryClient();
  return <Dialog open onOpenChange={v=>{if(!v)onFechar();}}><DialogContent className="sm:max-w-4xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Pacote a partir de toras serradas</DialogTitle><DialogDescription>{escolha?'Identificação e bitolas do pacote':'Há espécies ou AUTEX diferentes. Escolha um grupo para este pacote; faça os demais separadamente.'}</DialogDescription></DialogHeader>
    {escolha?<PacoteSerradoForm empresa={empresa} pacotes={pacotes.data??[]} sugestao={escolha} onCancelar={onFechar} onSalvo={()=>{void qc.invalidateQueries({queryKey:['madeira-serrada']});onSalvo();}}/>:<div className="space-y-2">{grupos.map((g,i)=><Button key={i} variant="outline" className="w-full h-auto whitespace-normal py-3 justify-start text-left" onClick={()=>setEscolha(g)}>{g.especie||'Espécie não informada'} · AUTEX {g.autex||'não informada'} · {g.plaquetas.length} toras</Button>)}</div>}
  </DialogContent></Dialog>;
}
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { COMPRIMENTOS, autexSerradasQuery, calcularBitola, comoBitola, salvarPacote, type BitolaSerrada, type PacoteSerrado } from '@/lib/madeira-serrada';
import type { SugestaoPacote } from '@/lib/pacote-de-toras';

export function PacoteSerradoForm({ empresa, pacote, pacotes, sugestao, onSalvo, onCancelar }: { empresa:string; pacote?:PacoteSerrado | undefined; sugestao?:SugestaoPacote | undefined; pacotes:PacoteSerrado[]; onSalvo:()=>void; onCancelar:()=>void }) {
  const [id] = useState(()=>pacote?.id ?? crypto.randomUUID());
  const [numero,setNumero] = useState(pacote?.numero ?? '');
  const [autex,setAutex] = useState(pacote?.autex ?? sugestao?.autex ?? '');
  const [confirmada,setConfirmada]=useState(!sugestao);
  const autexCadastradas = useQuery(autexSerradasQuery(empresa));
  const [data,setData] = useState(pacote?.data ?? new Date().toLocaleDateString('en-CA'));
  const [obs,setObs] = useState(pacote?.observacoes ?? '');
  const [especie,setEspecie] = useState(pacote?.itens[0]?.especie ?? sugestao?.especie ?? '');
  const nova = ():BitolaSerrada => ({especie,tipo_peca:'Viga',grossura:5,largura:15,distribuicao_pecas:Object.fromEntries(COMPRIMENTOS.map(c=>[c,0]))});
  const [itens,setItens] = useState<BitolaSerrada[]>(()=>pacote ? pacote.itens.map(comoBitola) : [nova()]);
  const [busy,setBusy] = useState(false);
  const resumo = itens.map(calcularBitola).reduce((r,i)=>({pecas:r.pecas+i.pecas,volume:r.volume+i.volume}),{pecas:0,volume:0});
  const comuns = [...new Set(pacotes.flatMap(p=>p.itens.map(i=>`${i.grossura}x${i.largura}`)))];
  const especies = [...new Set(pacotes.flatMap(p=>p.itens.map(i=>i.especie)))].sort();
  function alterar(index:number, valores:Partial<BitolaSerrada>) { setItens(s=>s.map((i,n)=>n===index ? {...i,...valores} : i)); }
  async function salvar(e:React.FormEvent) {
    e.preventDefault(); if(busy)return; if(!confirmada){toast.error('Confirme ou altere a AUTEX sugerida');return;} setBusy(true);
    try { await salvarPacote(empresa,id,{numero,data,observacoes:obs,autex},itens); toast.success('Pacote salvo'); onSalvo(); }
    catch(e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={salvar} className="space-y-4">
    {sugestao&&<div className="border border-primary bg-secondary rounded-lg p-3 space-y-2"><p className="text-sm font-semibold">AUTEX sugerida: {sugestao.autex||'não informada'} da tora serrada · Confirmar ou alterar se necessário</p><p className="text-xs">{sugestao.especie} · {sugestao.plaquetas.length} toras selecionadas</p><Button type="button" size="sm" variant={confirmada?'outline':'default'} onClick={()=>setConfirmada(true)}>{confirmada?'AUTEX confirmada':'Confirmar AUTEX sugerida'}</Button></div>}
    <div className="bg-primary text-primary-foreground rounded-lg p-4 grid grid-cols-3 gap-2 text-center">
      <div><strong className="text-2xl font-display">{itens.length}</strong><div className="text-xs">Bitolas</div></div>
      <div><strong className="text-2xl font-display">{resumo.pecas}</strong><div className="text-xs">Peças</div></div>
      <div><strong className="text-2xl font-display">{resumo.volume.toFixed(4).replace('.',',')}</strong><div className="text-xs">m³</div></div>
    </div>
    <div className="grid sm:grid-cols-3 gap-3">
      <label className="text-sm">Número do pacote<Input required aria-label="Número do pacote" value={numero} onChange={e=>setNumero(e.target.value)} /></label>
      <label className="text-sm">Espécie padrão<Input list="especies-serradas" aria-label="Espécie padrão" value={especie} onChange={e=>{setEspecie(e.target.value);setItens(s=>s.map(i=>i.especie===especie ? {...i,especie:e.target.value} : i));}} /></label>
      <label className="text-sm">Data<Input required type="date" aria-label="Data do pacote" value={data} onChange={e=>setData(e.target.value)} /></label>
    </div>
    <label className="block text-sm">AUTEX<Input list="autex-pacotes-serrados" aria-label="AUTEX do pacote" placeholder="Selecionar ou digitar AUTEX" value={autex} onChange={e=>{setAutex(e.target.value);setConfirmada(true);}} /></label>
    <datalist id="autex-pacotes-serrados">{(autexCadastradas.data??[]).map(a=><option key={a.numero} value={a.numero} />)}</datalist>
    <datalist id="especies-serradas">{especies.map(e=><option key={e} value={e} />)}</datalist>
    {itens.map((i,index)=> <section key={index} className="border rounded-lg p-3 space-y-3 bg-card">
      <div className="flex items-center justify-between"><h3 className="text-lg font-bold">Bitola {index+1} · {i.grossura} × {i.largura} cm</h3><Button type="button" variant="ghost" size="icon" aria-label={`Remover bitola ${index+1}`} title="Remover bitola" disabled={busy || itens.length===1} onClick={()=>setItens(s=>s.filter((_,n)=>n!==index))}><Trash2 /></Button></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="text-xs">Espécie<Input required aria-label={`Espécie bitola ${index+1}`} value={i.especie} list="especies-serradas" onChange={e=>alterar(index,{especie:e.target.value})} /></label>
        <label className="text-xs">Tipo de peça<select className="h-10 w-full border rounded-md bg-background px-2 text-sm" value={i.tipo_peca} aria-label={`Tipo de peça ${index+1}`} onChange={e=>alterar(index,{tipo_peca:e.target.value})}>{['Viga','Prancha','Caibro','Sarrafo','Tábua','Ripa','Outro'].map(t=><option key={t}>{t}</option>)}</select></label>
        <label className="text-xs">Grossura (cm)<Input required type="number" min="0.01" step="0.01" aria-label={`Grossura bitola ${index+1}`} value={i.grossura || ''} onChange={e=>alterar(index,{grossura:Number(e.target.value)})} /></label>
        <label className="text-xs">Largura (cm)<Input required type="number" min="0.01" step="0.01" aria-label={`Largura bitola ${index+1}`} value={i.largura || ''} onChange={e=>alterar(index,{largura:Number(e.target.value)})} /></label>
      </div>
      {comuns.length>0 && <label className="block text-xs">Bitolas cadastradas<select className="h-10 w-full border rounded-md bg-background px-2 text-sm" value="" aria-label={`Bitolas cadastradas ${index+1}`} onChange={e=>{const [grossura,largura]=e.target.value.split('x').map(Number);if(grossura && largura) alterar(index,{grossura,largura});}}><option value="">Selecionar bitola</option>{comuns.map(b=><option key={b} value={b}>{b.replace('x',' × ')} cm</option>)}</select></label>}
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-9 gap-2">{COMPRIMENTOS.map(c=><label key={c} className="text-xs text-center font-medium">{c.replace('.',',')} m<Input type="number" inputMode="numeric" min="0" step="1" aria-label={`Peças ${c}m bitola ${index+1}`} value={i.distribuicao_pecas[c] || ''} placeholder="0" className="text-center px-1" onChange={e=>alterar(index,{distribuicao_pecas:{...i.distribuicao_pecas,[c]:Number(e.target.value)}})} /></label>)}</div>
      <div className="text-sm font-semibold text-right">{calcularBitola(i).pecas} peças · {calcularBitola(i).volume.toFixed(4).replace('.',',')} m³</div>
    </section>)}
    <Button type="button" variant="outline" className="w-full whitespace-normal" disabled={busy} onClick={()=>setItens(s=>[...s,nova()])}><Plus /> Adicionar Bitola no Pacote</Button>
    <label className="block text-sm">Observações<Textarea aria-label="Observações do pacote" value={obs} onChange={e=>setObs(e.target.value)} /></label>
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onCancelar}>Cancelar</Button><Button disabled={busy} type="submit"><Save />{busy?'Salvando…':'Salvar pacote'}</Button></div>
  </form>;
}
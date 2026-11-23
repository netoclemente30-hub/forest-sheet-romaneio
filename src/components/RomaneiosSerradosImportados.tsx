import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, Pencil, Plus, Trash2, Save, FileText, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { salvarArquivo } from '@/lib/arquivo';
import { excelImportado, pdfImportado } from '@/lib/exportar-romaneio-importado';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { autexSerradasQuery } from '@/lib/madeira-serrada';
import { adicionarToraSerrada, lerRomaneioExcel, type ToraSerradaRef, totaisImportados, type AbaRomaneio, type CabImportado, type PecaImportada } from '@/lib/romaneio-serrado-importar';
import { fila } from '@/lib/offline/fila';
import { sincronizar } from '@/lib/offline/sync';
import { excluirImportado, importadosQuery, salvarImportado, type RomaneioImportado } from '@/lib/romaneio-serrado-importado';

function RomaneioEditor({empresa,documento,abas,onCancelar,onSalvo}:{empresa:string;documento?:RomaneioImportado;abas:AbaRomaneio[];onCancelar:()=>void;onSalvo:()=>void}) {
  const [id]=useState(()=>documento?.id??crypto.randomUUID());
  const tentativa=useRef<{conteudo:string;operacao:string}|null>(null);
  const [aba,setAba]=useState(abas.find(a=>a.itens.length)?.nome??'');
  const inicial=abas.find(a=>a.nome===aba);
  const [itens,setItens]=useState<PecaImportada[]>(()=>documento?documento.itens.map(i=>({...i})):inicial?.itens.map(i=>({...i}))??[]);
  const [cab,setCab]=useState<CabImportado>(()=>documento?{...documento.cab}:{numero_carga:inicial?.nome??'',data:new Date().toLocaleDateString('en-CA'),cliente_nome:inicial?.cliente??'',cliente_documento:'',motorista_nome:'',motorista_cpf:'',placa_veiculo:'',placa_reboque:'',observacoes:''});
  const [toras,setToras]=useState<ToraSerradaRef[]>(()=>(documento?.cab.toras_serradas??[]).map(t=>({...t})));
  const [novaAutex,setNovaAutex]=useState('');const [novaTora,setNovaTora]=useState('');const [erroTora,setErroTora]=useState('');
  function adicionarTora(){try{setToras(adicionarToraSerrada(toras,novaAutex,novaTora));setNovaTora('');setErroTora('');}catch(e){setErroTora(e instanceof Error?e.message:'Referência inválida');}}
  const [busy,setBusy]=useState(false);
  const autex=useQuery(autexSerradasQuery(empresa));
  const totals=totaisImportados(itens);
  function alterar(id:string,valor:Partial<PecaImportada>){setItens(s=>s.map(i=>i.id===id?{...i,...valor}:i));}
  function escolher(nome:string){if(!confirm('Trocar de aba descarta as alterações ainda não salvas. Continuar?'))return;const a=abas.find(a=>a.nome===nome);if(!a)return;setAba(nome);setItens(a.itens.map(i=>({...i})));setCab(s=>({...s,numero_carga:a.nome,cliente_nome:a.cliente}));}
  async function salvar(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);try{const {toras_serradas:_antigas,...base}=cab;const final:CabImportado=toras.length||documento?.cab.toras_serradas!==undefined?{...base,toras_serradas:toras}:base;const conteudo=JSON.stringify({cab:final,itens});if(tentativa.current?.conteudo!==conteudo)tentativa.current={conteudo,operacao:crypto.randomUUID()};const envio=tentativa.current;if(!envio)return;await salvarImportado(empresa,id,documento?.revisao??0,final,itens,envio.operacao);toast.success('Romaneio guardado neste aparelho — aguarda confirmação na nuvem');void sincronizar(fila()).catch(()=>{});onSalvo();}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível salvar');}finally{setBusy(false);}}
  return <form className="space-y-4" onSubmit={salvar}>
    {!documento&&<label className="block text-sm">Aba da planilha<select aria-label="Aba da planilha" className="h-10 w-full border rounded-md bg-background px-2" value={aba} disabled={busy} onChange={e=>escolher(e.target.value)}>{abas.map(a=><option key={a.nome} value={a.nome}>{a.nome} · {a.itens.reduce((n,i)=>n+i.quantidade,0)} peças</option>)}</select></label>}
    {!documento&&abas.find(a=>a.nome===aba)?.avisos.map(a=><p key={a} className="text-sm text-destructive">{a}</p>)}
    <div className="flex flex-wrap justify-between gap-2 border-y py-3"><strong>{totals.pecas} peças</strong><strong>{totals.volume.toFixed(4).replace('.',',')} m³</strong></div>
    <fieldset disabled={busy} className="grid sm:grid-cols-2 gap-3">
      <label className="text-sm">Número do romaneio<Input required aria-label="Número do romaneio importado" value={cab.numero_carga} onChange={e=>setCab(s=>({...s,numero_carga:e.target.value}))}/></label>
      <label className="text-sm">Data<Input required type="date" aria-label="Data do romaneio importado" value={cab.data} onChange={e=>setCab(s=>({...s,data:e.target.value}))}/></label>
      {([['cliente_nome','Cliente'],['cliente_documento','CPF/CNPJ do cliente'],['motorista_nome','Motorista'],['motorista_cpf','CPF do motorista'],['placa_veiculo','Placa do veículo'],['placa_reboque','Placa do reboque']] as const).map(([key,label])=><label key={key} className="text-sm">{label}<Input aria-label={`${label} do romaneio importado`} value={cab[key]} onChange={e=>setCab(s=>({...s,[key]:e.target.value}))}/></label>)}
    </fieldset>
    <datalist id="autex-romaneio-importado">{(autex.data??[]).map(a=><option key={a.numero} value={a.numero}/>)}</datalist>
    <fieldset disabled={busy} className="space-y-3">{itens.map((i,n)=><div key={i.id} className="border rounded-md p-3 space-y-2">
      <div className="flex justify-between items-center gap-2"><h3 className="font-semibold">Peças {n+1}</h3><Button type="button" variant="ghost" size="icon" title="Remover peças" aria-label={`Remover peças ${n+1}`} onClick={()=>setItens(s=>s.filter(p=>p.id!==i.id))}><Trash2/></Button></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {([['especie','Nome da madeira'],['nome_cientifico','Nome científico'],['autex','AUTEX'],['tipo_peca','Tipo de peça']] as const).map(([key,label])=><label key={key} className="text-xs">{label}<Input required={key==='especie'||key==='tipo_peca'} aria-label={`${label} peças ${n+1}`} list={key==='autex'?'autex-romaneio-importado':undefined} placeholder={key==='autex'?'Selecionar ou digitar':undefined} value={i[key]} onChange={e=>alterar(i.id,{[key]:e.target.value})}/></label>)}
        {([['grossura','Grossura (cm)',0.01,1000],['largura','Largura (cm)',0.01,1000],['comprimento','Comprimento (m)',0.01,100],['quantidade','Quantidade',1,1000000]] as const).map(([key,label,min,max])=><label key={key} className="text-xs">{label}<Input required type="number" step={key==='quantidade'?1:'any'} min={min} max={max} aria-label={`${label} peças ${n+1}`} value={i[key]||''} onChange={e=>alterar(i.id,{[key]:Number(e.target.value)})}/></label>)}
      </div><p className="text-sm text-right">{(i.grossura*i.largura*i.comprimento*i.quantidade/10000).toFixed(4).replace('.',',')} m³</p>
    </div>)}</fieldset>
    <Button type="button" variant="outline" disabled={busy} onClick={()=>{const p=itens.at(-1);setItens(s=>[...s,{id:crypto.randomUUID(),especie:p?.especie??'',nome_cientifico:p?.nome_cientifico??'',autex:p?.autex??'',tipo_peca:p?.tipo_peca??'Outro',grossura:p?.grossura??0,largura:p?.largura??0,comprimento:1,quantidade:1}]);}}><Plus/>Adicionar peças</Button>
    <section className="border rounded-md p-3 space-y-2" aria-label="Toras já serradas">
      <h3 className="font-semibold">Toras já serradas</h3>
      <p className="text-xs text-muted-foreground">Apenas referência no documento: não altera estoque, pacotes nem situação de serragem.</p>
      <fieldset disabled={busy} className="flex flex-wrap items-end gap-2">
        <label className="text-xs">AUTEX<Input aria-label="AUTEX da tora serrada" list="autex-romaneio-importado" value={novaAutex} onChange={e=>setNovaAutex(e.target.value)}/></label>
        <label className="text-xs">Número da tora<Input aria-label="Número da tora serrada" placeholder="Ex.: 39A" value={novaTora} onChange={e=>setNovaTora(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();adicionarTora();}}}/></label>
        <Button type="button" variant="outline" onClick={adicionarTora}><Plus/>Adicionar tora</Button>
      </fieldset>
      {erroTora&&<p role="alert" className="text-sm text-destructive">{erroTora}</p>}
      {toras.length>0&&<ul className="flex flex-wrap gap-2">{toras.map(t=><li key={`${t.autex}|${t.numero}`} className="flex items-center gap-1 border rounded-md pl-2 text-sm">AUTEX {t.autex} · Tora {t.numero}<Button type="button" variant="ghost" size="icon" disabled={busy} aria-label={`Remover tora ${t.numero} da AUTEX ${t.autex}`} onClick={()=>setToras(l=>l.filter(x=>x!==t))}><Trash2/></Button></li>)}</ul>}
    </section>
    <label className="block text-sm">Observações<Textarea disabled={busy} aria-label="Observações do romaneio importado" value={cab.observacoes} onChange={e=>setCab(s=>({...s,observacoes:e.target.value}))}/></label>
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onCancelar}>Cancelar</Button><Button type="submit" disabled={busy||!itens.length}><Save/>{busy?'Salvando…':'Salvar romaneio importado'}</Button></div>
  </form>;
}

export function RomaneiosSerradosImportados({empresa,podeOperar,q}:{empresa:string;podeOperar:boolean;q:string}) {
  const qc=useQueryClient();const query=useQuery(importadosQuery(empresa));
  const input=useRef<HTMLInputElement>(null);
  const [abas,setAbas]=useState<AbaRomaneio[]>([]);const [edit,setEdit]=useState<RomaneioImportado>();const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);
  async function ler(file:File){setBusy(true);try{if(file.size>10*1024*1024)throw new Error('Selecione uma planilha de até 10 MB');const a=lerRomaneioExcel(await file.arrayBuffer());if(!a.some(s=>s.itens.length))throw new Error('Não foram encontradas peças neste modelo. Verifique BITOLA, LARG., COMP. e QUANT.');setAbas(a);setEdit(undefined);setOpen(true);}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível ler a planilha');}finally{setBusy(false);if(input.current)input.current.value='';}}
  const nomeEmpresa=useQuery({queryKey:['nome-empresa-serrada',empresa],queryFn:async()=>{const {data,error}=await supabase.from('empresas').select('nome').eq('id',empresa).single();if(error)throw error;return data.nome;}});
  async function exportar(r:RomaneioImportado,tipo:'pdf'|'xlsx'){try{const a=tipo==='pdf'?await pdfImportado(r,nomeEmpresa.data??'Empresa'):await excelImportado(r,nomeEmpresa.data??'Empresa');await salvarArquivo(a);}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível exportar');}}
  async function excluir(r:RomaneioImportado){if(!confirm(`Excluir o romaneio ${r.cab.numero_carga}? Esta ação não altera o estoque.`))return;setBusy(true);try{await excluirImportado(empresa,r.id,r.cab.numero_carga);toast.success('Romaneio excluído');await salvo();}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível excluir');}finally{setBusy(false);}}
  async function salvo(){setOpen(false);setEdit(undefined);setAbas([]);await Promise.all([qc.invalidateQueries({queryKey:['romaneios-serrados-importados',empresa]}),qc.invalidateQueries({queryKey:['registros']})]);}
  return <div className="space-y-3">
    <div className="flex flex-wrap justify-between items-center gap-2"><h3 className="text-lg font-semibold">Romaneios importados</h3>{podeOperar&&<Button variant="outline" disabled={busy} onClick={()=>input.current?.click()}><FileUp/>{busy?'Lendo…':'Importar romaneio'}</Button>}</div>
    <input ref={input} hidden type="file" accept=".xlsx,.xls" aria-label="Planilha de romaneio serrado" onChange={e=>{const file=e.target.files?.[0];if(file)void ler(file);}}/>
    {query.isPending&&<p className="text-sm text-muted-foreground">Carregando romaneios importados…</p>}
    {query.error&&<p className="text-sm text-destructive">Não foi possível carregar os romaneios importados. <Button variant="outline" size="sm" onClick={()=>void query.refetch()}>Tentar novamente</Button></p>}
    <div className="divide-y">{(query.data??[]).filter(r=>r.empresa_id===empresa&&`${r.cab.numero_carga} ${r.cab.cliente_nome} ${r.cab.placa_veiculo} ${(r.cab.toras_serradas??[]).map(t=>`${t.autex} ${t.numero}`).join(' ')} ${r.itens.map(i=>`${i.especie} ${i.nome_cientifico} ${i.autex}`).join(' ')}`.toLowerCase().includes(q.toLowerCase())).map(r=><div key={r.id} className="py-3 space-y-2"><div className="flex flex-wrap justify-between gap-2"><div><h4 className="font-bold text-lg">{r.cab.numero_carga}</h4><p className="text-sm break-words">{r.cab.cliente_nome} · {[...new Set(r.itens.map(i=>i.especie))].join(', ')}</p></div><strong>{Number(r.total_volume_m3).toFixed(4).replace('.',',')} m³</strong></div><div className="flex flex-wrap justify-between items-center gap-2"><p className="text-xs text-muted-foreground">{r.total_pecas} peças · {r.cab.data.split('-').reverse().join('/')} · Importado · Sem expedição</p>{!!r.cab.toras_serradas?.length&&<p className="text-xs basis-full break-words">Toras já serradas: {r.cab.toras_serradas.map(t=>`AUTEX ${t.autex} · ${t.numero}`).join('; ')}</p>}<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>void exportar(r,'pdf')}><FileText/>PDF</Button><Button size="sm" variant="outline" onClick={()=>void exportar(r,'xlsx')}><FileSpreadsheet/>Excel</Button>{podeOperar&&<Button size="sm" variant="outline" onClick={()=>{setEdit(r);setAbas([]);setOpen(true);}}><Pencil/>Editar romaneio</Button>}{podeOperar&&<Button size="sm" variant="outline" disabled={busy} aria-label={`Excluir romaneio ${r.cab.numero_carga}`} onClick={()=>void excluir(r)}><Trash2/>Excluir</Button>}</div></div></div>)}</div>
    <Dialog open={podeOperar&&open} onOpenChange={v=>{if(!v)setOpen(false);}}><DialogContent className="sm:max-w-4xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{edit?'Editar romaneio importado':'Importar romaneio de madeira serrada'}</DialogTitle><DialogDescription>{edit?edit.cab.numero_carga:'Conferência da planilha'}</DialogDescription></DialogHeader>{open&&podeOperar&&<RomaneioEditor key={edit?.id??abas.map(a=>a.nome).join('|')} empresa={empresa} {...(edit?{documento:edit}:{})} abas={abas} onCancelar={()=>setOpen(false)} onSalvo={()=>void salvo()}/>}</DialogContent></Dialog>
  </div>;
}
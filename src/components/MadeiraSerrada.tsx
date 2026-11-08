import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Package, Truck, Pencil, Trash2, FileText, Download, Share2, ExternalLink, LoaderCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cargasSerradasQuery, excluirPacote, madeiraQuery, pacotesComFila, resumoPacotes, type CargaSerrada, type PacoteSerrado } from '@/lib/madeira-serrada';
import { useFilaOffline } from '@/hooks/useFilaOffline';
import { fila } from '@/lib/offline/fila';
import { gerarPdfRomaneioSerrado } from '@/lib/pdf-romaneio-serrado';
import { baixarArquivo, type ArquivoGerado } from '@/lib/arquivo';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { PacoteSerradoForm } from './PacoteSerradoForm';
import { CargaSerradaForm } from './CargaSerradaForm';

export function MadeiraSerrada({empresa}:{empresa:string|null}) {
  const qc=useQueryClient();
  const pacotes=useQuery(madeiraQuery(empresa));
  const pendentes=useFilaOffline();
  const cargas=useQuery(cargasSerradasQuery(empresa));
  const empresaQuery=useQuery({queryKey:['nome-empresa-serrada',empresa],enabled:!!empresa,queryFn:async()=>{const {data,error}=await supabase.from('empresas').select('nome').eq('id',empresa??'').single();if(error)throw error;return data.nome;}});
  const [aba,setAba]=useState('pacotes');
  const [q,setQ]=useState('');
  const [form,setForm]=useState<'pacote'|'carga'|null>(null);
  const [edit,setEdit]=useState<PacoteSerrado>();
  const [status,setStatus]=useState('disponiveis');
  const [pdf,setPdf]=useState<(ArquivoGerado&{url:string})|null>(null);
  const [gerando,setGerando]=useState(false);
  const [pdfOpen,setPdfOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  useEffect(()=>{if(!pdf)return undefined;return()=>URL.revokeObjectURL(pdf.url);},[pdf]);
  useEffect(()=>{setForm(null);setEdit(undefined);setPdf(null);setPdfOpen(false);},[empresa]);
  const todos=empresa?pacotesComFila(pacotes.data??[],pendentes.itens,empresa):[];
  const list=todos.filter(p=>(status==='todos'||(status==='disponiveis'?!p.carga_id:!!p.carga_id))&&`${p.numero} ${p.autex} ${p.itens.map(i=>i.especie).join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  const r=resumoPacotes(todos.filter(p=>!p.carga_id));
  async function atualizado(){setForm(null);setEdit(undefined);await Promise.all([qc.invalidateQueries({queryKey:['madeira-serrada']}),qc.invalidateQueries({queryKey:['cargas-serradas']}),qc.invalidateQueries({queryKey:['registros']})]);}
  async function excluir(p:PacoteSerrado){if(!empresa||busy||!confirm(`Excluir o pacote ${p.numero} e todas as suas bitolas?`))return;setBusy(true);try{if(p.fila_id)await fila().remover(p.fila_id);else await excluirPacote(empresa,p.id);toast.success('Pacote excluído');await atualizado();}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível excluir');}finally{setBusy(false);}}
  async function gerar(c:CargaSerrada){setPdfOpen(true);setGerando(true);setPdf(null);try{const a=await gerarPdfRomaneioSerrado(c,empresaQuery.data??'Empresa');setPdf({...a,url:URL.createObjectURL(a.blob)});}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível gerar PDF');setPdfOpen(false);}finally{setGerando(false);}}
  async function compartilhar(){if(!pdf)return;const file=new File([pdf.blob],pdf.nome,{type:'application/pdf'});if(!navigator.canShare?.({files:[file]})){baixarArquivo(pdf);toast.info('PDF salvo para anexar no WhatsApp');return;}try{await navigator.share({files:[file],title:'Romaneio de madeira serrada'});}catch(e){if(e instanceof DOMException&&e.name==='AbortError')return;toast.error('Não foi possível compartilhar. Use Baixar PDF.');}}
  if(!empresa)return <p className="py-6 text-muted-foreground">Selecione uma empresa para acessar a madeira serrada.</p>;
  return <div className="space-y-4">
    <Tabs value={aba} onValueChange={v=>{setAba(v);setQ('');}}><TabsList className="w-full h-auto"><TabsTrigger className="flex-1 whitespace-normal" value="pacotes"><Package className="size-4 mr-1"/>Estoque de Pacotes</TabsTrigger><TabsTrigger className="flex-1 whitespace-normal" value="cargas"><Truck className="size-4 mr-1"/>Romaneios de Carga</TabsTrigger></TabsList></Tabs>
    <div className="border-y py-3 flex flex-wrap justify-between gap-2"><span><strong>{todos.filter(p=>!p.carga_id).length}</strong> pacotes disponíveis · <strong>{r.pecas}</strong> peças</span><strong>{r.volume.toFixed(4).replace('.',',')} m³</strong></div>
    <div className="flex flex-wrap justify-between items-center gap-2"><h2 className="text-2xl font-bold">{aba==='pacotes'?'Estoque de Pacotes':'Romaneios de Carga'}</h2><Button disabled={pacotes.isPending||!!pacotes.error} onClick={()=>{setEdit(undefined);setForm(aba==='pacotes'?'pacote':'carga');}}><Plus/>{aba==='pacotes'?'Novo pacote':'Nova carga'}</Button></div>
    <Input aria-label="Buscar madeira serrada" placeholder={aba==='pacotes'?'Buscar pacote ou espécie':'Buscar carga, cliente ou placa'} value={q} onChange={e=>setQ(e.target.value)}/>
    {aba==='pacotes'&&<select aria-label="Situação dos pacotes" className="w-full h-10 rounded-md border bg-background px-2 text-sm" value={status} onChange={e=>setStatus(e.target.value)}><option value="disponiveis">Disponíveis no pátio</option><option value="expedidos">Expedidos</option><option value="todos">Todos os pacotes</option></select>}
    {(pacotes.isPending||cargas.isPending)&&<p className="text-muted-foreground">Carregando madeira serrada…</p>}
    {(pacotes.error||cargas.error)&&<div className="border border-destructive rounded-lg p-3 text-sm text-destructive">Não foi possível carregar os dados. <Button variant="outline" size="sm" onClick={()=>{void pacotes.refetch();void cargas.refetch();}}>Tentar de novo</Button></div>}
    {aba==='pacotes'?<div className="divide-y border rounded-lg">{list.map(p=>{const s=resumoPacotes([p]);return <div key={p.id} className="p-3 space-y-2"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="text-xl font-bold">Pacote {p.numero}</h3><p className="text-sm break-words">{[...new Set(p.itens.map(i=>i.especie))].join(', ')}</p></div><strong className="text-lg">{s.volume.toFixed(4).replace('.',',')} m³</strong></div><div className="flex flex-wrap justify-between items-center gap-2"><p className="text-xs text-muted-foreground">{p.data.split('-').reverse().join('/')} · AUTEX {p.autex || '—'} · {s.bitolas} bitolas · {s.pecas} peças · {p.fila_id ? p.erro_fila ? 'Erro ao enviar — editar e tentar de novo' : 'Salvo no aparelho · pendente de envio' : p.carga_id?'Expedido':'No pátio'}</p>{!p.carga_id&&<div className="flex gap-1"><Button variant="outline" size="sm" disabled={busy} onClick={()=>{setEdit(p);setForm('pacote');}}><Pencil/>Editar</Button><Button variant="ghost" size="icon" disabled={busy} title="Excluir pacote" aria-label={`Excluir pacote ${p.numero}`} onClick={()=>excluir(p)}><Trash2/></Button></div>}</div><details><summary className="text-sm cursor-pointer text-primary">Bitolas e peças</summary><div className="mt-2 space-y-1">{p.itens.map(i=><p className="text-sm" key={i.id}>{i.tipo_peca} · {i.grossura} × {i.largura} cm · {i.total_pecas} peças · {Number(i.volume_m3).toFixed(4).replace('.',',')} m³</p>)}{p.observacoes&&<p className="text-sm text-muted-foreground">{p.observacoes}</p>}</div></details></div>})}{!list.length&&!pacotes.isPending&&<p className="p-4 text-sm text-muted-foreground">Nenhum pacote encontrado.</p>}</div>:<div className="divide-y border rounded-lg">{(cargas.data??[]).filter(c=>`${c.numero_carga} ${c.cliente_nome} ${c.placa_veiculo}`.toLowerCase().includes(q.toLowerCase())).map(c=><div key={c.id} className="p-3 space-y-2"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="text-xl font-bold">{c.numero_carga}</h3><p className="text-sm">{c.cliente_nome}</p></div><strong>{Number(c.total_volume_m3).toFixed(4).replace('.',',')} m³</strong></div><p className="text-xs text-muted-foreground">{c.data.split('-').reverse().join('/')} · {c.motorista_nome} · {c.placa_veiculo} · {c.total_pecas} peças</p><Button variant="outline" size="sm" disabled={gerando||pacotes.isPending} onClick={()=>gerar({...c,pacotes:todos.filter(p=>p.carga_id===c.id)})}><FileText/>PDF da carga</Button></div>)}{!cargas.data?.length&&!cargas.isPending&&<p className="p-4 text-sm text-muted-foreground">Nenhuma carga expedida.</p>}</div>}
    <Dialog open={!!form} onOpenChange={v=>{if(!v)setForm(null);}}><DialogContent className="sm:max-w-4xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{form==='carga'?'Nova carga de madeira serrada':edit?`Editar pacote ${edit.numero}`:'Novo pacote de madeira serrada'}</DialogTitle><DialogDescription>{form==='carga'?'Identificação da carga':'Identificação do pacote'}</DialogDescription></DialogHeader>{form==='pacote'&&<PacoteSerradoForm key={edit?.id??'novo'} empresa={empresa} pacote={edit} pacotes={todos} onSalvo={()=>void atualizado()} onCancelar={()=>setForm(null)}/>} {form==='carga'&&<CargaSerradaForm empresa={empresa} pacotes={todos} onSalvo={()=>void atualizado()} onCancelar={()=>setForm(null)}/>}</DialogContent></Dialog>
    <Dialog open={pdfOpen} onOpenChange={setPdfOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{gerando?'Gerando PDF…':'Romaneio pronto'}</DialogTitle><DialogDescription className="break-all">{pdf?.nome??'Madeira serrada'}</DialogDescription></DialogHeader>{gerando&&<LoaderCircle className="animate-spin mx-auto"/>}{pdf&&<div className="space-y-2"><Button className="w-full" onClick={()=>baixarArquivo(pdf)}><Download/>Baixar PDF</Button><Button className="w-full" variant="secondary" onClick={()=>void compartilhar()}><Share2/>Compartilhar PDF</Button><Button className="w-full" asChild variant="outline"><a href={pdf.url} target="_blank" rel="noopener noreferrer"><ExternalLink/>Abrir PDF</a></Button></div>}</DialogContent></Dialog>
  </div>;
}
import { useState } from 'react';
import { toast } from 'sonner';
import { Truck } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { resumoPacotes, salvarCargaSerrada, type CabCarga, type PacoteSerrado } from '@/lib/madeira-serrada';

export function CargaSerradaForm({empresa,pacotes,onSalvo,onCancelar}:{empresa:string;pacotes:PacoteSerrado[];onSalvo:()=>void;onCancelar:()=>void}) {
  const [id] = useState(()=>crypto.randomUUID());
  const [cab,setCab] = useState<CabCarga>({numero_carga:'',data:new Date().toLocaleDateString('en-CA'),cliente_nome:'',cliente_documento:'',motorista_nome:'',motorista_cpf:'',placa_veiculo:'',placa_reboque:''});
  const [sel,setSel] = useState<string[]>([]);
  const [q,setQ] = useState('');
  const [busy,setBusy] = useState(false);
  const disponiveis = pacotes.filter(p=>!p.carga_id);
  const filtrados = disponiveis.filter(p=>`${p.numero} ${p.itens.map(i=>i.especie).join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  const resumo = resumoPacotes(disponiveis.filter(p=>sel.includes(p.id)));
  const campos:{key:keyof CabCarga;label:string;required?:boolean;type?:string}[] = [
    {key:'numero_carga',label:'Número da carga',required:true},{key:'data',label:'Data da carga',required:true,type:'date'},
    {key:'cliente_nome',label:'Cliente / Destinatário',required:true},{key:'cliente_documento',label:'CNPJ / CPF do cliente'},
    {key:'motorista_nome',label:'Motorista',required:true},{key:'motorista_cpf',label:'CPF do motorista'},
    {key:'placa_veiculo',label:'Caminhão / Cavalo',required:true},{key:'placa_reboque',label:'Carreta / Reboque'},
  ];
  async function salvar(e:React.FormEvent) {
    e.preventDefault();if(busy)return;setBusy(true);
    try {await salvarCargaSerrada(empresa,id,cab,sel);toast.success('Carga expedida');onSalvo();}
    catch(e){toast.error(e instanceof Error?e.message:'Não foi possível salvar a carga');}
    finally{setBusy(false);}
  }
  return <form onSubmit={salvar} className="space-y-4">
    <div className="grid sm:grid-cols-2 gap-3">{campos.map(c=><label key={c.key} className="text-sm">{c.label}<Input required={c.required} type={c.type??'text'} aria-label={c.label} value={cab[c.key]} onChange={e=>setCab(s=>({...s,[c.key]:e.target.value}))} /></label>)}</div>
    <h3 className="text-xl font-bold">Pacotes disponíveis ({disponiveis.length})</h3>
    <Input aria-label="Buscar pacotes da carga" placeholder="Buscar pacote ou espécie" value={q} onChange={e=>setQ(e.target.value)} />
    <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Selecionar todos os pacotes" checked={filtrados.length>0&&filtrados.every(p=>sel.includes(p.id))} onCheckedChange={v=>setSel(s=>v ? [...new Set([...s,...filtrados.map(p=>p.id)])]:s.filter(id=>!filtrados.some(p=>p.id===id)))} />Selecionar todos</label>
    <div className="max-h-80 overflow-y-auto divide-y border rounded-lg">{filtrados.map(p=>{const r=resumoPacotes([p]);return <label key={p.id} className="flex items-center gap-3 p-3 cursor-pointer"><Checkbox aria-label={`Incluir pacote ${p.numero}`} checked={sel.includes(p.id)} onCheckedChange={v=>setSel(s=>v?[...s,p.id]:s.filter(id=>id!==p.id))}/><div className="flex-1 min-w-0"><strong>Pacote {p.numero}</strong><p className="text-xs text-muted-foreground break-words">{[...new Set(p.itens.map(i=>i.especie))].join(', ')} · {r.pecas} peças</p></div><span className="text-sm font-semibold whitespace-nowrap">{r.volume.toFixed(4).replace('.',',')} m³</span></label>})}{!filtrados.length&&<p className="p-4 text-sm text-muted-foreground">Nenhum pacote disponível.</p>}</div>
    <div className="bg-primary text-primary-foreground rounded-lg p-4 flex flex-wrap justify-between gap-2 font-semibold"><span>{sel.length} pacotes · {resumo.pecas} peças</span><span>{resumo.volume.toFixed(4).replace('.',',')} m³</span></div>
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancelar} disabled={busy}>Cancelar</Button><Button type="submit" disabled={busy||!sel.length}><Truck />{busy?'Salvando…':'Expedir carga'}</Button></div>
  </form>;
}
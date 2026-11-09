import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Tora } from '@/lib/data';
import type { ItemFila } from '@/lib/offline/fila';
import { listarTorasEncaixadas } from '@/lib/toras-encaixadas';
import { torasEncaixadasQuery } from '@/lib/toras-encaixadas-query';
import { fmtM3 } from '@/lib/volume';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw } from 'lucide-react';

const valor = (n: number | null, unidade: string) => n === null ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ${unidade}`;
const assinado = (n: number | null, percentual = false) => n === null ? '—' : `${n > 0 ? '+' : ''}${n.toLocaleString('pt-BR', { minimumFractionDigits: percentual ? 2 : 4, maximumFractionDigits: percentual ? 2 : 4 })}${percentual ? '%' : ' m³'}`;

export function TorasEncaixadas({ empresa, toras, itens }: { empresa: string | null; toras: Tora[]; itens: ItemFila[] }) {
  const registros = useQuery(torasEncaixadasQuery(empresa));
  const [busca, setBusca] = useState('');
  const [autex, setAutex] = useState('');
  const [dia, setDia] = useState('');
  const [limite, setLimite] = useState(50);
  const lista = useMemo(() => listarTorasEncaixadas(registros.data ?? [], toras, itens, empresa), [registros.data, toras, itens, empresa]);
  const filtradas = useMemo(() => lista.filter(({ tora: t, data }) => {
    const s = busca.trim().toLowerCase();
    return (!s || [t.plaqueta, t.arvore, t.secao, t.autex, t.especie, t.nome_cientifico].some(v => String(v ?? '').toLowerCase().includes(s)))
      && (!autex || t.autex?.toLowerCase().includes(autex.trim().toLowerCase()))
      && (!dia || new Date(data).toLocaleDateString('en-CA') === dia);
  }), [lista, busca, autex, dia]);
  return <section className="space-y-4" aria-label="Toras encaixadas">
    <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-bold">Toras Encaixadas</h2><Button size="icon" variant="outline" aria-label="Atualizar toras encaixadas" disabled={registros.isFetching} onClick={() => registros.refetch()}><RefreshCw /></Button></div>
    <Input aria-label="Buscar toras encaixadas" placeholder="Buscar plaqueta, árvore, seção ou espécie" value={busca} onChange={e => { setBusca(e.target.value); setLimite(50); }} />
    <div className="grid grid-cols-2 gap-2">
      <label className="space-y-1 text-xs">AUTEX<Input aria-label="AUTEX das toras encaixadas" placeholder="Todas" value={autex} onChange={e => { setAutex(e.target.value); setLimite(50); }} /></label>
      <label className="space-y-1 text-xs">Data do encaixe<Input type="date" aria-label="Data do encaixe" value={dia} onChange={e => { setDia(e.target.value); setLimite(50); }} /></label>
    </div>
    <div className="flex flex-wrap justify-between gap-2 border-y py-3 text-sm"><b>{filtradas.length} toras encaixadas</b><span>Medido: {fmtM3(filtradas.reduce((s, r) => s + r.medido, 0))} m³</span></div>
    {registros.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os encaixes. Tente atualizar.</p>}
    {registros.isPending && empresa && <p className="text-sm text-muted-foreground">Carregando encaixes…</p>}
    <div className="space-y-3">
      {filtradas.slice(0, limite).map(r => <article key={r.id} className="rounded-lg border bg-card p-3 space-y-3">
        <div className="space-y-1">
          <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{r.tora.especie || 'Sem espécie'}</h3><span className="text-xs text-muted-foreground">{r.estado}</span></div>
          {r.tora.nome_cientifico && <p className="text-xs italic text-muted-foreground break-words">{r.tora.nome_cientifico}</p>}
          <p className="font-semibold text-sm">Plaqueta {r.tora.plaqueta} · Árvore {r.tora.arvore} · Seção {r.tora.secao || '—'}</p>
          <p className="text-xs break-words">AUTEX: {r.tora.autex || '—'}</p>
          <p className="text-xs text-muted-foreground">Encaixe: {new Date(r.data).toLocaleString('pt-BR')}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 border-y py-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">Volume sistema / saldo</dt><dd className="font-bold">{valor(r.saldo, 'm³')}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Volume medido</dt><dd className="font-bold">{valor(r.medido, 'm³')}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Diferença (saldo − medido)</dt><dd className="font-bold">{assinado(r.diferenca)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Diferença / saldo</dt><dd className="font-bold">{assinado(r.percentual, true)}</dd></div>
        </dl>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          {([['D. topo 1', r.tora.d_topo1], ['D. topo 2', r.tora.d_topo2], ['D. pé 1', r.tora.d_pe1], ['D. pé 2', r.tora.d_pe2]] as const).map(([nome, n]) => <div key={nome}><dt className="text-xs text-muted-foreground">{nome}</dt><dd>{valor(n, 'cm')}</dd></div>)}
          <div className="col-span-2"><dt className="text-xs text-muted-foreground">Comprimento</dt><dd>{valor(r.tora.comprimento, 'm')}</dd></div>
        </dl>
      </article>)}
    </div>
    {!filtradas.length && !registros.isPending && !registros.isError && <p className="text-sm text-muted-foreground">Nenhuma tora encaixada encontrada.</p>}
    {filtradas.length > limite && <Button variant="outline" className="w-full" onClick={() => setLimite(n => n + 50)}>Mostrar mais</Button>}
  </section>;
}
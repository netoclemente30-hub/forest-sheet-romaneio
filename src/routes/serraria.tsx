import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { romaneiosQuery, torasQuery } from "@/lib/data";
import { fmtM3 } from "@/lib/volume";
import { selecionarToras } from "@/lib/tora-qr";
import { fila } from "@/lib/offline/fila";
import { estaOnline } from "@/lib/offline/sync";
import { capturarLog } from "@/lib/registro";
import { registrarOperacao } from "@/lib/registro-operacao";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RelatorioToras } from "@/components/RelatorioToras";
import { ordenarToras, type Ordem } from "@/lib/relatorio";
import { estoqueComFila } from "@/lib/tora-origem";
import { useFilaOffline } from "@/hooks/useFilaOffline";
import { useAuth } from "@/hooks/useAuth";
import { getEmpresaAtiva } from "@/lib/empresa";
import { Warehouse, Factory } from "lucide-react";
import { MadeiraSerrada } from "@/components/MadeiraSerrada";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PacoteDeToras } from '@/components/PacoteDeToras';
import { gruposParaPacote, type SugestaoPacote } from '@/lib/pacote-de-toras';
import { TorasEncaixadas } from '@/components/TorasEncaixadas';

export const Route = createFileRoute("/serraria")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Serraria — Manejo Florestal" },
      { name: "description", content: "Pátio de toras, pacotes multi-bitola e romaneios de carga de madeira serrada da empresa." },
      { property: "og:title", content: "Serraria — Manejo Florestal" },
      { property: "og:description", content: "Pátio de toras, pacotes multi-bitola e romaneios de carga de madeira serrada da empresa." },
    ],
  }),
  component: Serraria,
});

type Aba = "patio" | "serradas" | "madeira" | "encaixadas";

function Serraria() {
  const qc = useQueryClient();
  const toras = useQuery(torasQuery);
  const roms = useQuery(romaneiosQuery);
  const [aba, setAba] = useState<Aba>("patio");
  const [patio, setPatio] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [gruposPacote,setGruposPacote]=useState<SugestaoPacote[]>([]);
  const [dia, setDia] = useState("");
  const [autex, setAutex] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("plaqueta_desc");
  const [lim, setLim] = useState(100);
  const { empresaId } = useAuth();
  const empresa = getEmpresaAtiva() ?? empresaId;
  const pendentes = useFilaOffline();
  const estoque = useMemo(() => estoqueComFila(toras.data ?? [], pendentes.itens, empresa), [toras.data, pendentes.itens, empresa]);

  const romPatio = useMemo(() => new Map((roms.data ?? []).filter((r) => r.recebido_em).map((r) => [r.id, r.patio ?? "Sem pátio"])), [roms.data]);
  const nomePatio = (t: (typeof estoque)[number]) => t.romaneio_id && romPatio.has(t.romaneio_id) ? romPatio.get(t.romaneio_id) : t.origem === "serraria" ? "Conferência de estoque" : null;
  const recebidas = useMemo(() => estoque.filter((t) => t.origem === "serraria" || (t.romaneio_id && romPatio.has(t.romaneio_id))), [estoque, romPatio]);
  const patios = useMemo(() => [...new Set([...romPatio.values(), ...(recebidas.some((t) => t.origem === "serraria" && !t.romaneio_id) ? ["Conferência de estoque"] : [])])].sort(), [romPatio, recebidas]);
  const lista = useMemo(() => {
    const s = q.trim().toLowerCase();
    return ordenarToras(recebidas
      .filter((t) => (aba === "patio" ? !t.serrada_em : !!t.serrada_em))
      .filter((t) => !patio || (t.romaneio_id && romPatio.has(t.romaneio_id) ? romPatio.get(t.romaneio_id) : "Conferência de estoque") === patio)
      .filter((t) => (!dia || new Date(t.created_at).toLocaleDateString("en-CA") === dia) && (!autex || t.autex === autex))
      .filter((t) => !s || String(t.plaqueta) === s || String(t.arvore) === s || [t.especie, t.nome_cientifico, t.autex].some((v) => v?.toLowerCase().includes(s))), ordem);
  }, [recebidas, aba, patio, q, romPatio, dia, autex, ordem]);
  const selecionadasVisiveis = lista.filter((t) => sel.includes(t.plaqueta));

  async function serrar(desfazer = false) {
    if (!selecionadasVisiveis.length) return;
    if (selecionadasVisiveis.some((t) => !toras.data?.some((x) => x.empresa_id === t.empresa_id && x.plaqueta === t.plaqueta))) { toast.error("Envie primeiro as medições pendentes antes de serrar estas toras"); return; }
    if (!desfazer && !confirm(`Dar baixa de ${selecionadasVisiveis.length} toras como serradas?`)) return;
    const log = await capturarLog(desfazer ? "Toras voltaram ao pátio" : "Toras serradas", `${selecionadasVisiveis.length} toras · plaquetas ${selecionadasVisiveis.map((t) => t.plaqueta).slice(0, 10).join(", ")}${selecionadasVisiveis.length > 10 ? "…" : ""}`);
    const porEmpresa = new Map<string, number[]>();
    for (const t of lista.filter((t) => sel.includes(t.plaqueta))) porEmpresa.set(t.empresa_id, [...(porEmpresa.get(t.empresa_id) ?? []), t.plaqueta]);
    if (!estaOnline()) {
      setBusy(true);
      for (const [empresa_id, plaquetas] of porEmpresa) await fila().enfileirar({ tipo: "toras_serradas", plaquetas, desfazer, empresa_id, log });
      setBusy(false);
      if(!desfazer)setAba('serradas');else setSel([]);
      toast.success("Baixa salva offline — será enviada quando conectar");
      return;
    }
    setBusy(true);
    try { for (const [empresa, plaquetas] of porEmpresa) await registrarOperacao("toras_serradas", empresa, { desfazer }, plaquetas, log, crypto.randomUUID()); }
    catch (error) { setBusy(false); toast.error(error instanceof Error ? error.message : "Não foi possível serrar"); return; }
    setBusy(false);
    toast.success(desfazer ? `${selecionadasVisiveis.length} toras voltaram ao pátio` : `${selecionadasVisiveis.length} toras serradas`);
    if(!desfazer)setAba('serradas');else setSel([]);
    await qc.invalidateQueries({ queryKey: ["toras"] });
  }

  const vol = lista.reduce((n, t) => n + Number(t.volume), 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold uppercase">Serraria</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/saldo">Conferir saldo</Link></Button>
          <Button asChild variant="secondary" size="sm"><Link to="/entrada"><Warehouse /> Entrada no pátio</Link></Button>
        </div>
      </div>
      <Tabs value={aba} onValueChange={(v) => { setAba(v as Aba); setSel([]); }}><TabsList className="w-full h-auto grid grid-cols-2 sm:grid-cols-4"><TabsTrigger value="patio" className="whitespace-normal">Pátio de toras</TabsTrigger><TabsTrigger value="serradas" className="whitespace-normal">Toras serradas</TabsTrigger><TabsTrigger value="encaixadas" className="whitespace-normal">Toras Encaixadas</TabsTrigger><TabsTrigger value="madeira" className="whitespace-normal">Madeira serrada</TabsTrigger></TabsList></Tabs>
      {aba === "madeira" ? <MadeiraSerrada empresa={empresa} /> : aba === "encaixadas" ? <TorasEncaixadas empresa={empresa} toras={estoque} itens={pendentes.itens} /> : <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={!patio ? "default" : "outline"} onClick={() => setPatio("")}>Todos os pátios</Button>
        {patios.map((p) => <Button key={p} size="sm" variant={patio === p ? "default" : "outline"} onClick={() => setPatio(p)}>{p}</Button>)}
      </div>
      <Input placeholder="Buscar plaqueta, árvore, espécie ou AUTEX" value={q} onChange={(e) => setQ(e.target.value)} className="h-11" />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs space-y-1">Data de lançamento<Input type="date" aria-label="Data de lançamento" value={dia} onChange={(e) => setDia(e.target.value)} /></label>
        <label className="text-xs space-y-1">AUTEX<Input aria-label="Filtrar AUTEX" placeholder="Todas" value={autex} onChange={(e) => setAutex(e.target.value)} /></label>
      </div>
      <RelatorioToras lista={lista} selecionadas={sel} ordem={ordem} setOrdem={setOrdem} titulo={aba === "patio" ? "Pátio de toras da serraria" : "Toras serradas"} />
      <div className="flex items-center justify-between rounded-lg bg-forest text-primary-foreground px-4 py-3">
        <span className="text-sm opacity-80">{lista.length} toras {aba === "patio" ? "no pátio" : "serradas"}</span>
        <span className="font-display text-3xl font-bold">{fmtM3(vol)} m³</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Selecionar todas" checked={lista.length > 0 && lista.every((t) => sel.includes(t.plaqueta))} onCheckedChange={(v) => setSel((s) => selecionarToras(s, lista.map((t) => t.plaqueta), v === true))} />Selecionar todas</label>
        {aba === "patio"
          ? <Button disabled={busy || !selecionadasVisiveis.length} onClick={() => serrar()}><Factory /> Serrar ({selecionadasVisiveis.length})</Button>
          : <Button variant="outline" disabled={busy || !selecionadasVisiveis.length} onClick={() => serrar(true)}>Voltar ao pátio ({selecionadasVisiveis.length})</Button>}
      </div>
      {sel.length > 0 && <Button size="sm" variant="ghost" onClick={() => setSel([])}>Limpar seleção</Button>}
      {aba==='serradas'&&<Button className="w-full h-auto whitespace-normal py-3" disabled={busy||!empresa||!selecionadasVisiveis.length} onClick={()=>{if(empresa){const grupos=gruposParaPacote(selecionadasVisiveis,empresa);if(grupos.length)setGruposPacote(grupos);else toast.error('Selecione toras serradas da empresa ativa');}}}>Gerar pacote a partir destas toras ({selecionadasVisiveis.length})</Button>}
      <div className="bg-card border rounded-xl divide-y">
        {lista.slice(0, lim).map((t) => (
          <label key={t.plaqueta} className="flex items-center gap-3 p-3 cursor-pointer">
            <Checkbox aria-label={`Selecionar tora ${t.plaqueta}`} checked={sel.includes(t.plaqueta)} onCheckedChange={(v) => setSel((s) => selecionarToras(s, [t.plaqueta], v === true))} />
            <div className="font-display text-xl font-bold w-14">{t.plaqueta}</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold leading-snug">{t.especie}</div>
              <div className="text-xs text-muted-foreground">Árv. {t.arvore} · Sec. {t.secao ?? "–"} · AUTEX {t.autex ?? "—"} · {nomePatio(t)}{t.serrada_em && ` · serrada ${new Date(t.serrada_em).toLocaleDateString("pt-BR")}`}</div>
            </div>
            <div className="text-sm font-semibold">{fmtM3(Number(t.volume))}</div>
          </label>
        ))}
        {!lista.length && <div className="p-4 text-sm text-muted-foreground">{aba === "patio" ? "Nenhuma tora no pátio." : "Nenhuma tora serrada ainda."}</div>}
      </div>
      {lista.length > lim && <Button variant="outline" className="w-full" onClick={() => setLim(lim + 100)}>Mostrar mais</Button>}
      </>}
      {empresa&&gruposPacote.length>0&&<PacoteDeToras key={JSON.stringify(gruposPacote)} empresa={empresa} grupos={gruposPacote} onFechar={()=>setGruposPacote([])} onSalvo={()=>{setGruposPacote([]);setSel([]);setAba('madeira');}}/>}
    </div>
  );
}

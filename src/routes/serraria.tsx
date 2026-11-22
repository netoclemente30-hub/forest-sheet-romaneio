import { pode } from "@/lib/funcoes";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { romaneiosQuery, torasQuery, type Tora } from "@/lib/data";
import { resolverQrSerragem } from "@/lib/qr-serragem";
import { QrScanner } from "@/components/QrScanner";
import { QrImage } from "@/components/QrImage";
import { situacaoSerragem } from "@/lib/situacao-serragem";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { fmtM3, fmtM3Sinal } from "@/lib/volume";
import { CartaoMedidaComercial, SeletorMedida, TextoMedidaComercial, type ModoMedida } from "@/components/MedidaComercial";
import { totaisComerciais, volumeComercial } from "@/lib/medida-comercial";
import { qrTora, selecionarToraParaQr, selecionarToras } from "@/lib/tora-qr";
import { fila } from "@/lib/offline/fila";
import { estaOnline } from "@/lib/offline/sync";
import { capturarLog } from "@/lib/registro";
import { registrarOperacao } from "@/lib/registro-operacao";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RelatorioToras } from "@/components/RelatorioToras";
import { ordenarToras, type Ordem } from "@/lib/relatorio";
import { estoqueComFila, romaneiosComFila } from "@/lib/tora-origem";
import { useFilaOffline } from "@/hooks/useFilaOffline";
import { useAuth } from "@/hooks/useAuth";
import { getEmpresaAtiva } from "@/lib/empresa";
import { empresaDaOperacao } from "@/lib/cadastros-empresa";
import { Warehouse, Factory, ScanLine, X, QrCode, Printer, ExternalLink } from "lucide-react";
import { MadeiraSerrada } from "@/components/MadeiraSerrada";
import { SerrariaAbas } from "@/components/SerrariaAbas";
import { abaSerrariaDoBusca } from "@/lib/nav";
import { PacoteDeToras } from '@/components/PacoteDeToras';
import { gruposParaPacote, type SugestaoPacote } from '@/lib/pacote-de-toras';
import { TorasEncaixadas } from '@/components/TorasEncaixadas';

export const Route = createFileRoute("/serraria")({
  staticData: { sitemap: false },
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
  validateSearch: (s: Record<string, unknown>) => ({ aba: abaSerrariaDoBusca(s["aba"]) }),
  component: Serraria,
});

type Aba = "patio" | "serradas" | "madeira" | "encaixadas";

function Serraria() {
  const qc = useQueryClient();
  const toras = useQuery(torasQuery);
  const roms = useQuery(romaneiosQuery);
  const navigate = useNavigate();
  const { aba: abaUrl } = Route.useSearch();
  const aba: Aba = abaUrl ?? "patio";
  const irParaAba = (a: Aba) => navigate({ to: "/serraria", search: { aba: a } });
  const [patio, setPatio] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(false);
  const [etiqueta, setEtiqueta] = useState("");
  const [toraLida, setToraLida] = useState<number | null>(null);
  const [qrPlaqueta, setQrPlaqueta] = useState<number | null>(null);
  const [gruposPacote,setGruposPacote]=useState<SugestaoPacote[]>([]);
  const [dia, setDia] = useState("");
  const [autex, setAutex] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("plaqueta_desc");
  const [modo, setModo] = useState<ModoMedida>("fisica");
  const [lim, setLim] = useState(100);
  const { empresaId, papel, isSuperAdmin } = useAuth();
  const podeOperar = pode(papel, "serraria_operar");
  const empresa = empresaDaOperacao(isSuperAdmin, empresaId, getEmpresaAtiva());
  const pendentes = useFilaOffline();
  const estoque = useMemo(() => empresa
    ? estoqueComFila((toras.data ?? []).filter((t) => t.empresa_id === empresa), pendentes.itens, empresa)
        .filter((t) => t.empresa_id === empresa)
    : [], [toras.data, pendentes.itens, empresa]);
  useEffect(() => { setSel([]); }, [aba]);

  const romPatio = useMemo(() => new Map(empresa
    ? romaneiosComFila((roms.data ?? []).filter((r) => r.empresa_id === empresa), pendentes.itens, empresa)
        .filter((r) => r.empresa_id === empresa && r.recebido_em)
        .map((r) => [r.id, r.patio ?? "Sem pátio"])
    : []), [roms.data, pendentes.itens, empresa]);
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
  const aberta = recebidas.find((t) => t.empresa_id === empresa && t.plaqueta === toraLida);
  const toraQr = selecionarToraParaQr(recebidas, empresa, qrPlaqueta ?? 0);

  function abrirEtiqueta(raw: string) {
    try {
      const t = resolverQrSerragem(raw, estoque, empresa);
      if (!recebidas.some((r) => r.empresa_id === t.empresa_id && r.plaqueta === t.plaqueta)) {
        toast.error("Esta tora ainda não está no pátio. Registre a entrada da carga primeiro.");
        return;
      }
      setScan(false);
      setToraLida(t.plaqueta);
      setPatio(""); setDia(""); setAutex(""); setQ(String(t.plaqueta));
      irParaAba(t.serrada_em ? "serradas" : "patio");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível ler a etiqueta"); }
  }

  async function serrar(desfazer = false, selecionadas: Tora[] = selecionadasVisiveis) {
    if (!podeOperar || !selecionadas.length) return;
    if (selecionadas.some((t) => !toras.data?.some((x) => x.empresa_id === t.empresa_id && x.plaqueta === t.plaqueta))) { toast.error("Envie primeiro as medições pendentes antes de serrar estas toras"); return; }
    if (!desfazer && !confirm(`Dar baixa de ${selecionadas.length} toras como serradas?`)) return;
    const log = await capturarLog(desfazer ? "Toras voltaram ao pátio" : "Toras serradas", `${selecionadas.length} toras · plaquetas ${selecionadas.map((t) => t.plaqueta).slice(0, 10).join(", ")}${selecionadas.length > 10 ? "…" : ""}`);
    const porEmpresa = new Map<string, number[]>();
    for (const t of selecionadas) porEmpresa.set(t.empresa_id, [...(porEmpresa.get(t.empresa_id) ?? []), t.plaqueta]);
    if (!estaOnline()) {
      setBusy(true);
      try { for (const [empresa_id, plaquetas] of porEmpresa) await fila().enfileirar({ tipo: "toras_serradas", plaquetas, desfazer, empresa_id, log }); }
      catch (error) { setBusy(false); toast.error(error instanceof Error ? error.message : "Não foi possível guardar a baixa neste aparelho"); return; }
      setBusy(false);
      setToraLida(null);
      if(!desfazer)irParaAba('serradas');else setSel([]);
      toast.success("Baixa salva offline — será enviada quando conectar");
      return;
    }
    setBusy(true);
    try { for (const [empresa, plaquetas] of porEmpresa) await registrarOperacao("toras_serradas", empresa, { desfazer }, plaquetas, log, crypto.randomUUID()); }
    catch (error) { setBusy(false); toast.error(error instanceof Error ? error.message : "Não foi possível serrar"); return; }
    setBusy(false);
    setToraLida(null);
    toast.success(desfazer ? `${selecionadas.length} toras voltaram ao pátio` : `${selecionadas.length} toras serradas`);
    if(!desfazer)irParaAba('serradas');else setSel([]);
    await qc.invalidateQueries({ queryKey: ["toras"] });
  }

  const totais = totaisComerciais(lista);
  const vol = modo === "comercial" ? totais.comercial : totais.fisico;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold uppercase">Serraria</h1>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm"><Link to="/entrada"><Warehouse /> Entrada no pátio</Link></Button>
        </div>
      </div>
      <SerrariaAbas atual={aba} />
      {aba === "madeira" ? <MadeiraSerrada empresa={empresa} /> : aba === "encaixadas" ? <TorasEncaixadas empresa={empresa} toras={estoque} itens={pendentes.itens} /> : <>
      <Button variant="secondary" onClick={() => setScan(true)} disabled={!empresa || toras.isLoading || roms.isLoading}><ScanLine /> Ler etiqueta</Button>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={!patio ? "default" : "outline"} onClick={() => setPatio("")}>Todos os pátios</Button>
        {patios.map((p) => <Button key={p} size="sm" variant={patio === p ? "default" : "outline"} onClick={() => setPatio(p)}>{p}</Button>)}
      </div>
      <Input placeholder="Buscar plaqueta, árvore, espécie ou AUTEX" value={q} onChange={(e) => setQ(e.target.value)} className="h-11" />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs space-y-1">Data de lançamento<Input type="date" aria-label="Data de lançamento" value={dia} onChange={(e) => setDia(e.target.value)} /></label>
        <label className="text-xs space-y-1">AUTEX<Input aria-label="Filtrar AUTEX" placeholder="Todas" value={autex} onChange={(e) => setAutex(e.target.value)} /></label>
      </div>
      <SeletorMedida valor={modo} onChange={setModo} />
      <RelatorioToras lista={lista} selecionadas={sel} ordem={ordem} setOrdem={setOrdem} titulo={aba === "patio" ? "Pátio de toras da serraria" : "Toras serradas"} medida={modo} />
      <div className="rounded-lg bg-forest text-primary-foreground px-4 py-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm opacity-80">{lista.length} toras {aba === "patio" ? "no pátio" : "serradas"} · {modo === "comercial" ? "comercial" : "físico"}</span>
          <span className="font-display text-3xl font-bold">{fmtM3(vol)} m³</span>
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-xs opacity-90"><span>Físico: {fmtM3(totais.fisico)} m³</span><span>Comercial: {fmtM3(totais.comercial)} m³</span><span>Dif.: {fmtM3Sinal(totais.diferenca)} m³</span></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Selecionar todas" checked={lista.length > 0 && lista.every((t) => sel.includes(t.plaqueta))} onCheckedChange={(v) => setSel((s) => selecionarToras(s, lista.map((t) => t.plaqueta), v === true))} />Selecionar todas</label>
        {podeOperar && (aba === "patio"
          ? <Button disabled={busy || !selecionadasVisiveis.length} onClick={() => serrar()}><Factory /> Serrar ({selecionadasVisiveis.length})</Button>
          : <Button variant="outline" disabled={busy || !selecionadasVisiveis.length} onClick={() => serrar(true)}>Voltar ao pátio ({selecionadasVisiveis.length})</Button>)}
      </div>
      {sel.length > 0 && <Button size="sm" variant="ghost" onClick={() => setSel([])}>Limpar seleção</Button>}
      {podeOperar&&aba==='serradas'&&<Button className="w-full h-auto whitespace-normal py-3" disabled={busy||!empresa||!selecionadasVisiveis.length} onClick={()=>{if(empresa){const grupos=gruposParaPacote(selecionadasVisiveis,empresa);if(grupos.length)setGruposPacote(grupos);else toast.error('Selecione toras serradas da empresa ativa');}}}>Gerar pacote a partir destas toras ({selecionadasVisiveis.length})</Button>}
      <div className="bg-card border rounded-xl divide-y">
        {lista.slice(0, lim).map((t) => (
          <div key={t.plaqueta} className="flex items-center gap-3 p-3">
            <Checkbox aria-label={`Selecionar tora ${t.plaqueta}`} checked={sel.includes(t.plaqueta)} onCheckedChange={(v) => setSel((s) => selecionarToras(s, [t.plaqueta], v === true))} />
            <div className="font-display text-xl font-bold w-14">{t.plaqueta}</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold leading-snug">{t.especie}</div>
              <div className="text-xs text-muted-foreground">Árv. {t.arvore} · Sec. {t.secao ?? "–"} · AUTEX {t.autex ?? "—"} · {nomePatio(t)}{t.serrada_em && ` · serrada ${new Date(t.serrada_em).toLocaleDateString("pt-BR")}`}</div>
              {modo === "comercial" && <TextoMedidaComercial tora={t} classe="text-xs text-muted-foreground" />}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="text-right text-sm font-semibold">
                {fmtM3(modo === "comercial" ? volumeComercial(t) : Number(t.volume))}
                {modo === "comercial" && <div className="text-xs font-normal text-muted-foreground">físico {fmtM3(Number(t.volume))}</div>}
              </div>
              <Button type="button" size="sm" variant="outline"
                aria-label={`Ver QR code da plaqueta ${t.plaqueta}`}
                onClick={() => setQrPlaqueta(t.plaqueta)}>
                <QrCode className="size-4" /> Ver QR
              </Button>
            </div>
          </div>
        ))}
        {!lista.length && <div className="p-4 text-sm text-muted-foreground">{aba === "patio" ? "Nenhuma tora no pátio." : "Nenhuma tora serrada ainda."}</div>}
      </div>
      {lista.length > lim && <Button variant="outline" className="w-full" onClick={() => setLim(lim + 100)}>Mostrar mais</Button>}
      </>}
      <Dialog open={scan} onOpenChange={setScan}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ler etiqueta da tora</DialogTitle><DialogDescription>QR Code da etiqueta</DialogDescription></DialogHeader>
          {scan && <QrScanner onScan={abrirEtiqueta} onClose={() => toast.error("Câmera indisponível. Permita o acesso à câmera ou informe a plaqueta abaixo.")} />}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); abrirEtiqueta(etiqueta); }}>
            <Input aria-label="Plaqueta ou conteúdo da etiqueta" placeholder="Plaqueta ou conteúdo do QR" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} />
            <Button type="submit" disabled={!etiqueta.trim()}>Abrir</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!aberta} onOpenChange={(v) => { if (!v) setToraLida(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Tora {aberta?.arvore} · {aberta?.secao ?? "—"}</DialogTitle><DialogDescription>Plaqueta {aberta?.plaqueta} · {aberta?.serrada_em ? "Já serrada" : "No pátio"}</DialogDescription></DialogHeader>
          {aberta && <>
            <div className="space-y-2">
              <p className="text-xl font-semibold break-words">{aberta.especie}</p>
              <p className="text-sm text-muted-foreground italic">{aberta.nome_cientifico}</p>
              <p className="text-sm break-words">AUTEX {aberta.autex ?? "—"}</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted-foreground">Diâmetros topo</dt><dd>{aberta.d_topo1 ?? "—"} × {aberta.d_topo2 ?? "—"} cm</dd></div>
                <div><dt className="text-muted-foreground">Diâmetros pé</dt><dd>{aberta.d_pe1 ?? "—"} × {aberta.d_pe2 ?? "—"} cm</dd></div>
                <div><dt className="text-muted-foreground">Comprimento</dt><dd>{aberta.comprimento ?? "—"} m</dd></div>
                <div><dt className="text-muted-foreground">Volume</dt><dd className="font-semibold">{fmtM3(Number(aberta.volume))} m³</dd></div>
              </dl>
              <CartaoMedidaComercial tora={aberta} />
              <p role="status" className="rounded-md border p-2 text-sm font-medium">{situacaoSerragem(aberta.serrada_em).detalhe}</p>
              <Button variant="outline" className="w-full" onClick={() => { setQrPlaqueta(aberta.plaqueta); setToraLida(null); }}>
                <QrCode className="size-4" /> Ver QR code da tora
              </Button>
            </div>
            {podeOperar && !aberta.serrada_em && <Button disabled={busy} onClick={() => serrar(false, [aberta])}><Factory /> Serrar esta tora</Button>}
            <Button variant="outline" onClick={() => { setToraLida(null); setEtiqueta(""); setScan(true); }}><ScanLine /> Ler outra etiqueta</Button>
            <Button variant="ghost" onClick={() => setToraLida(null)}><X /> Fechar</Button>
          </>}
        </DialogContent>
      </Dialog>
      <Dialog open={qrPlaqueta !== null} onOpenChange={(v) => { if (!v) setQrPlaqueta(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>QR code · plaqueta {toraQr?.plaqueta ?? qrPlaqueta}</DialogTitle>
            <DialogDescription>Rastreabilidade da tora no pátio da serraria · plaqueta vinculada à empresa selecionada</DialogDescription>
          </DialogHeader>
          {toraQr ? (
            <div className="flex flex-col items-center gap-3">
              <QrImage value={qrTora(toraQr)} size={220} />
              <p className="text-center text-sm font-semibold">{toraQr.especie} · Árvore {toraQr.arvore} · Secção {toraQr.secao ?? "—"}</p>
              <p className="text-center text-xs text-muted-foreground">AUTEX {toraQr.autex ?? "—"} · {fmtM3(Number(toraQr.volume))} m³</p>
              <p role="status" className="w-full rounded-md border bg-secondary p-3 text-center text-sm font-semibold">
                {situacaoSerragem(toraQr.serrada_em).detalhe}
              </p>
              {toraQr.publico_id ? (
                <a href={qrTora(toraQr)} target="_blank" rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-center text-sm font-medium">
                  <ExternalLink className="size-4" /> Consultar ficha pública
                </a>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  Sincronize a tora para liberar a consulta pública. Este QR ainda contém dados para leitura interna.
                </p>
              )}
              <Button asChild variant="outline" className="w-full">
                <Link to="/etiquetas" search={{ p: String(toraQr.plaqueta) }}>
                  <Printer className="size-4" /> Imprimir etiqueta
                </Link>
              </Button>
            </div>
          ) : <p className="text-sm text-muted-foreground">Tora não disponível na empresa ou no pátio selecionado.</p>}
        </DialogContent>
      </Dialog>
      {podeOperar&&empresa&&gruposPacote.length>0&&<PacoteDeToras key={JSON.stringify(gruposPacote)} empresa={empresa} grupos={gruposPacote} onFechar={()=>setGruposPacote([])} onSalvo={()=>{setGruposPacote([]);setSel([]);irParaAba('madeira');}}/>}
    </div>
  );
}

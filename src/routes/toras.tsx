import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { capturarLog, gravarRegistro } from "@/lib/registro";
import { useEffect, useMemo, useState } from "react";
import { salvarArquivo, type ArquivoGerado } from "@/lib/arquivo";
import { ORDENS, ordenarToras, exportarExcel, exportarPdf, exportarSinaflor, type Ordem } from "@/lib/relatorio";
import { torasQuery, arvoresQuery, type Tora } from "@/lib/data";
import { fmtM3 } from "@/lib/volume";
import { ToraForm } from "@/components/ToraForm";
import { QrImage } from "@/components/QrImage";
import { qrTora, selecionarToras } from "@/lib/tora-qr";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, QrCode, Printer, FileSpreadsheet, FileText, Pencil, Download, LoaderCircle, ExternalLink } from "lucide-react";
import { ToraEditor, excluirTora } from "@/components/ToraEditor";
import { registrarOperacao } from "@/lib/registro-operacao";

export const Route = createFileRoute("/toras")({
  validateSearch: (s: Record<string, unknown>) => ({ nova: s["nova"] === true || s["nova"] === "true" ? true : undefined }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Toras — Manejo Florestal" },
      { name: "description", content: "Cálculos de inventário: toras medidas, volumes e QR codes." },
      { property: "og:title", content: "Toras — Manejo Florestal" },
      { property: "og:description", content: "Cálculos de inventário: toras medidas, volumes e QR codes." },
    ],
  }),
  component: TorasPage,
});

type Filtro = "todas" | "patio" | "carregadas";

function TorasPage() {
  const { nova } = Route.useSearch();
  return <TorasList nova={nova === true} />;
}

export function TorasList({ nova }: { nova?: boolean }) {
  const toras = useQuery(torasQuery);
  const arvores = useQuery(arvoresQuery);
  const [open, setOpen] = useState(!!nova);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("patio");
  const [qr, setQr] = useState<number | null>(null);
  const [novas, setNovas] = useState<number[]>([]);
  const [lim, setLim] = useState(100);
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const [dia, setDia] = useState("");
  const [autex, setAutex] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("plaqueta_desc");
  const [edit, setEdit] = useState<Tora | null>(null);
  const [gerando, setGerando] = useState(false);
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [arquivo, setArquivo] = useState<(ArquivoGerado & { url: string }) | null>(null);
  useEffect(() => {
    if (!arquivo) return;
    return () => { setTimeout(() => URL.revokeObjectURL(arquivo.url), 30_000); };
  }, [arquivo]);

  async function gerarRelatorio(formato: "excel" | "pdf" | "sinaflor") {
    if (gerando) return;
    setGerando(true);
    setArquivo(null);
    setRelatorioAberto(true);
    try {
      const itens = paraRelatorio();
      if (!itens.length) throw new Error("Selecione toras presentes no filtro para gerar o relatório.");
      const resultado = await (formato === "pdf" ? exportarPdf(itens, "Toras") : formato === "excel" ? exportarExcel(itens) : exportarSinaflor(itens));
      setArquivo({ ...resultado, url: URL.createObjectURL(resultado.blob) });
    } catch (error) {
      setRelatorioAberto(false);
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o relatório. Tente novamente.");
    } finally {
      setGerando(false);
    }
  }

  const lista = useMemo(() => {
    const t = (toras.data ?? []).filter((x) => (filtro === "todas" ? true : filtro === "patio" ? !x.carregada : x.carregada) && (!dia || new Date(x.created_at).toLocaleDateString("en-CA") === dia) && (!autex || x.autex === autex));
    const s = q.trim().toLowerCase();
    const f = !s ? t : t.filter((x) => String(x.plaqueta) === s || String(x.arvore) === s || (x.especie ?? "").toLowerCase().includes(s));
    return ordenarToras(f, ordem);
  }, [toras.data, q, filtro, dia, autex, ordem]);
  const paraRelatorio = () => (selecionadas.length ? lista.filter((t) => selecionadas.includes(t.plaqueta)) : lista);

  const tora = toras.data?.find((t) => t.plaqueta === qr);
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const romaneadasSel = (toras.data ?? []).filter((t) => t.carregada && selecionadas.includes(t.plaqueta)).map((t) => t.plaqueta);

  async function excluirRomaneadas() {
    if (!romaneadasSel.length || !confirm(`Excluir ${romaneadasSel.length} toras já romaneadas? Isso não pode ser desfeito.`)) return;
    if (!navigator.onLine) { toast.error("Precisa de internet para excluir"); return; }
    // Plaquetas se repetem entre empresas: apagar só as toras da empresa de cada uma.
    const porEmpresa = new Map<string, number[]>();
    for (const t of (toras.data ?? []).filter((x) => x.carregada && romaneadasSel.includes(x.plaqueta)))
      porEmpresa.set(t.empresa_id, [...(porEmpresa.get(t.empresa_id) ?? []), t.plaqueta]);
    for (const [emp, plaquetas] of porEmpresa) {
      try { await registrarOperacao("toras_delete", emp, {}, plaquetas, await capturarLog("Toras romaneadas excluídas", `${plaquetas.length} toras · plaquetas ${plaquetas.join(", ")}`)); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir"); return; }
    }
    toast.success(`${romaneadasSel.length} toras excluídas`);
    setSelecionadas((s) => s.filter((p) => !romaneadasSel.includes(p)));
    await qc.invalidateQueries({ queryKey: ["toras"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold uppercase">Toras</h1>
        <Button onClick={() => setOpen(true)}><Plus /> Lançar</Button>
      </div>
      {novas.length > 0 && (
        <Button asChild variant="secondary" className="w-full">
          <Link to="/etiquetas" search={{ p: novas.join(",") }}><Printer /> Imprimir QR das {novas.length} toras lançadas agora</Link>
        </Button>
      )}
      <Input placeholder="Buscar plaqueta, árvore ou espécie" value={q} onChange={(e) => setQ(e.target.value)} className="h-11" />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs space-y-1">Data de lançamento<Input type="date" aria-label="Data de lançamento" value={dia} onChange={(e) => setDia(e.target.value)} /></label>
        <label className="text-xs space-y-1">AUTEX<Input aria-label="Filtrar AUTEX" placeholder="Todas" value={autex} onChange={(e) => setAutex(e.target.value)} /></label>
      </div>
      <div className="flex gap-2">
        {(["patio", "carregadas", "todas"] as Filtro[]).map((k) => (
          <Button key={k} size="sm" variant={filtro === k ? "default" : "outline"} onClick={() => setFiltro(k)}>
            {k === "patio" ? "No pátio" : k === "carregadas" ? "Carregadas" : "Todas"}
          </Button>
        ))}
      </div>
      <div className="bg-card border rounded-xl p-3 space-y-2">
        <label className="text-xs space-y-1 block">Ordenar por
          <select aria-label="Ordenar toras" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className="w-full h-10 rounded-md border bg-background px-2 text-sm">
            {ORDENS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </label>
        <div className="text-xs text-muted-foreground">Relatório: {selecionadas.length ? `${selecionadas.length} toras selecionadas` : `${lista.length} toras do filtro`}</div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={!lista.length || gerando} onClick={() => gerarRelatorio("excel")}><FileSpreadsheet /> Excel</Button>
          <Button variant="outline" disabled={!lista.length || gerando} onClick={() => gerarRelatorio("pdf")}><FileText /> PDF</Button>
          <Button variant="outline" className="col-span-2" disabled={!lista.length || gerando} onClick={() => gerarRelatorio("sinaflor")}><FileSpreadsheet /> Exportar para SINAFLOR (repique)</Button>
        </div>
      </div>
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{lista.length} toras</span>
        <span>{fmtM3(lista.reduce((n, x) => n + Number(x.volume), 0))} m³</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Selecionar todas as toras filtradas" checked={lista.length > 0 && lista.every((t) => selecionadas.includes(t.plaqueta))} onCheckedChange={(v) => setSelecionadas((s) => selecionarToras(s, lista.map((t) => t.plaqueta), v === true))} />Selecionar filtradas</label>
        <Button asChild variant="secondary"><Link to="/etiquetas" search={{ p: selecionadas.join(",") }} aria-disabled={!selecionadas.length} onClick={(e) => { if (!selecionadas.length) e.preventDefault(); }}><Printer /> Etiquetas ({selecionadas.length})</Link></Button>
        {isAdmin && romaneadasSel.length > 0 && <Button variant="destructive" size="sm" onClick={excluirRomaneadas}><Trash2 /> Excluir romaneadas ({romaneadasSel.length})</Button>}
        {selecionadas.length > 0 && <Button variant="ghost" size="sm" onClick={() => setSelecionadas([])}>Limpar seleção</Button>}
      </div>
      <div className="bg-card border rounded-xl divide-y">
        {lista.slice(0, lim).map((t) => (
          <div key={t.plaqueta} className="flex items-center gap-2 p-3">
            <Checkbox aria-label={`Selecionar tora ${t.plaqueta}`} className="shrink-0" checked={selecionadas.includes(t.plaqueta)} onCheckedChange={(v) => setSelecionadas((s) => selecionarToras(s, [t.plaqueta], v === true))} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold leading-snug">{t.especie ?? "Sem espécie"}</div>
              <div className="text-xs text-muted-foreground">Plaqueta {t.plaqueta} · Árv. {t.arvore} · Sec. {t.secao ?? "–"} · {t.comprimento ?? "–"} m</div>
              <div className="text-xs text-muted-foreground">AUTEX {t.autex ?? "—"} · <span className="font-semibold text-foreground">{fmtM3(Number(t.volume))} m³</span>{t.carregada && <span className="font-semibold text-success"> · carregada</span>}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="QR code" onClick={() => setQr(t.plaqueta)}><QrCode className="h-4 w-4" /></Button>
              {isAdmin && <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Editar tora ${t.plaqueta}`} onClick={() => setEdit(t)}><Pencil className="h-4 w-4" /></Button>}
              {isAdmin && <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Excluir tora ${t.plaqueta}`} onClick={async () => { if (await excluirTora(t)) await qc.invalidateQueries({ queryKey: ["toras"] }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
            </div>
          </div>
        ))}
        {toras.isLoading && <div className="p-4 text-sm text-muted-foreground">Carregando…</div>}
        {toras.isError && <div className="p-4 text-sm text-destructive">Não foi possível carregar as toras.</div>}
        {!toras.isLoading && !lista.length && <div className="p-4 text-sm text-muted-foreground">Nenhuma tora encontrada.</div>}
      </div>
      {lista.length > lim && <Button variant="outline" className="w-full" onClick={() => setLim(lim + 200)}>Mostrar mais</Button>}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader><SheetTitle className="font-display text-2xl uppercase">Lançar tora</SheetTitle></SheetHeader>
          <div className="p-4 pt-0">
            <ToraForm toras={toras.data ?? []} arvores={arvores.data ?? []} onSaved={(p) => { setNovas((n) => [...n, p]); }} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader><SheetTitle className="font-display text-2xl uppercase">Plaqueta {edit?.plaqueta}</SheetTitle></SheetHeader>
          {edit && <div className="p-4 pt-0"><ToraEditor tora={edit} toras={toras.data ?? []} onDone={() => setEdit(null)} /></div>}
        </SheetContent>
      </Sheet>

      <Dialog open={relatorioAberto} onOpenChange={setRelatorioAberto}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{gerando ? "Gerando relatório…" : "Relatório pronto"}</DialogTitle>
            <DialogDescription className="break-all">{arquivo?.nome ?? "Preparando o arquivo"}</DialogDescription>
          </DialogHeader>
          {gerando && <LoaderCircle className="mx-auto animate-spin" aria-label="Gerando arquivo" />}
          {arquivo && <div className="space-y-2">
            <Button className="w-full" onClick={() => { salvarArquivo(arquivo).catch(() => toast.error("Não foi possível salvar o arquivo. Tente novamente.")); }}><Download /> Salvar arquivo</Button>
            {arquivo.blob.type === "application/pdf" && <Button asChild variant="outline" className="w-full"><a href={arquivo.url} target="_blank" rel="noopener noreferrer"><ExternalLink /> Abrir PDF</a></Button>}
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={qr !== null} onOpenChange={(o) => !o && setQr(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="font-display text-2xl">Plaqueta {qr}</DialogTitle></DialogHeader>
          {qr !== null && (
            <div className="flex flex-col items-center gap-2">
              {tora && <QrImage value={qrTora(tora)} size={200} />}
              <div className="text-sm text-center">{tora?.especie} · Árv. {tora?.arvore} · {tora && fmtM3(Number(tora.volume))} m³</div>
              <Button asChild className="w-full"><Link to="/etiquetas" search={{ p: String(qr) }}><Printer /> Imprimir etiqueta</Link></Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

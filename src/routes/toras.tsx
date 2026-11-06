import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ORDENS, ordenarToras, exportarExcel, exportarPdf, exportarSinaflor, type Ordem } from "@/lib/relatorio";
import { torasQuery, arvoresQuery } from "@/lib/data";
import { fmtM3 } from "@/lib/volume";
import { ToraForm } from "@/components/ToraForm";
import { QrImage } from "@/components/QrImage";
import { qrTora, selecionarToras } from "@/lib/tora-qr";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, QrCode, Printer, FileSpreadsheet, FileText } from "lucide-react";

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

  const lista = useMemo(() => {
    const t = (toras.data ?? []).filter((x) => (filtro === "todas" ? true : filtro === "patio" ? !x.carregada : x.carregada) && (!dia || new Date(x.created_at).toLocaleDateString("en-CA") === dia) && (!autex || x.autex === autex));
    const s = q.trim().toLowerCase();
    const f = !s ? t : t.filter((x) => String(x.plaqueta) === s || String(x.arvore) === s || (x.especie ?? "").toLowerCase().includes(s));
    return ordenarToras(f, ordem);
  }, [toras.data, q, filtro, dia, autex, ordem]);
  const paraRelatorio = () => (selecionadas.length ? lista.filter((t) => selecionadas.includes(t.plaqueta)) : lista);

  const tora = toras.data?.find((t) => t.plaqueta === qr);

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
          <Button variant="outline" disabled={!lista.length} onClick={() => exportarExcel(paraRelatorio())}><FileSpreadsheet /> Excel</Button>
          <Button variant="outline" disabled={!lista.length} onClick={() => exportarPdf(paraRelatorio(), "Toras")}><FileText /> PDF</Button>
          <Button variant="outline" className="col-span-2" disabled={!lista.length} onClick={() => exportarSinaflor(paraRelatorio())}><FileSpreadsheet /> Exportar para SINAFLOR (repique)</Button>
        </div>
      </div>
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{lista.length} toras</span>
        <span>{fmtM3(lista.reduce((n, x) => n + Number(x.volume), 0))} m³</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Selecionar todas as toras filtradas" checked={lista.length > 0 && lista.every((t) => selecionadas.includes(t.plaqueta))} onCheckedChange={(v) => setSelecionadas((s) => selecionarToras(s, lista.map((t) => t.plaqueta), v === true))} />Selecionar filtradas</label>
        <Button asChild variant="secondary"><Link to="/etiquetas" search={{ p: selecionadas.join(",") }} aria-disabled={!selecionadas.length} onClick={(e) => { if (!selecionadas.length) e.preventDefault(); }}><Printer /> Etiquetas ({selecionadas.length})</Link></Button>
        {selecionadas.length > 0 && <Button variant="ghost" size="sm" onClick={() => setSelecionadas([])}>Limpar seleção</Button>}
      </div>
      <div className="bg-card border rounded-xl divide-y">
        {lista.slice(0, lim).map((t) => (
          <div key={t.plaqueta} className="flex items-center gap-3 p-3">
            <Checkbox aria-label={`Selecionar tora ${t.plaqueta}`} checked={selecionadas.includes(t.plaqueta)} onCheckedChange={(v) => setSelecionadas((s) => selecionarToras(s, [t.plaqueta], v === true))} />
            <div className="font-display text-xl font-bold w-14">{t.plaqueta}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{t.especie}</div>
              <div className="text-xs text-muted-foreground">Árv. {t.arvore} · Sec. {t.secao ?? "–"} · {t.comprimento} m · AUTEX {t.autex ?? "—"} {t.carregada && <span className="text-success font-semibold">· carregada</span>}</div>
            </div>
            <div className="text-sm font-semibold">{fmtM3(Number(t.volume))}</div>
            <Button size="icon" variant="ghost" aria-label="QR code" onClick={() => setQr(t.plaqueta)}><QrCode /></Button>
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

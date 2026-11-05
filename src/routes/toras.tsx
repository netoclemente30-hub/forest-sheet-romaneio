import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { torasQuery, arvoresQuery } from "@/lib/data";
import { fmtM3 } from "@/lib/volume";
import { ToraForm } from "@/components/ToraForm";
import { QrImage } from "@/components/QrImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, QrCode, Printer } from "lucide-react";

export const Route = createFileRoute("/toras")({
  validateSearch: (s: Record<string, unknown>) => ({ nova: s.nova === true || s.nova === "true" ? true : undefined }),
  head: () => ({
    meta: [
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
  const toras = useQuery(torasQuery);
  const arvores = useQuery(arvoresQuery);
  const [open, setOpen] = useState(!!nova);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("patio");
  const [qr, setQr] = useState<number | null>(null);
  const [novas, setNovas] = useState<number[]>([]);
  const [lim, setLim] = useState(100);

  const lista = useMemo(() => {
    const t = (toras.data ?? []).filter((x) => (filtro === "todas" ? true : filtro === "patio" ? !x.carregada : x.carregada));
    const s = q.trim().toLowerCase();
    if (!s) return t;
    return t.filter((x) => String(x.plaqueta) === s || String(x.arvore) === s || (x.especie ?? "").toLowerCase().includes(s));
  }, [toras.data, q, filtro]);

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
      <div className="flex gap-2">
        {(["patio", "carregadas", "todas"] as Filtro[]).map((k) => (
          <Button key={k} size="sm" variant={filtro === k ? "default" : "outline"} onClick={() => setFiltro(k)}>
            {k === "patio" ? "No pátio" : k === "carregadas" ? "Carregadas" : "Todas"}
          </Button>
        ))}
      </div>
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{lista.length} toras</span>
        <span>{fmtM3(lista.reduce((n, x) => n + Number(x.volume), 0))} m³</span>
      </div>
      <div className="bg-card border rounded-xl divide-y">
        {lista.slice(0, lim).map((t) => (
          <div key={t.plaqueta} className="flex items-center gap-3 p-3">
            <div className="font-display text-xl font-bold w-14">{t.plaqueta}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{t.especie}</div>
              <div className="text-xs text-muted-foreground">Árv. {t.arvore} · Sec. {t.secao ?? "–"} · {t.comprimento} m {t.carregada && <span className="text-success font-semibold">· carregada</span>}</div>
            </div>
            <div className="text-sm font-semibold">{fmtM3(Number(t.volume))}</div>
            <Button size="icon" variant="ghost" aria-label="QR code" onClick={() => setQr(t.plaqueta)}><QrCode /></Button>
          </div>
        ))}
        {toras.isLoading && <div className="p-4 text-sm text-muted-foreground">Carregando…</div>}
      </div>
      {lista.length > lim && <Button variant="outline" className="w-full" onClick={() => setLim(lim + 200)}>Mostrar mais</Button>}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader><SheetTitle className="font-display text-2xl uppercase">Lançar tora</SheetTitle></SheetHeader>
          <div className="p-4 pt-0">
            <ToraForm toras={toras.data ?? []} arvores={arvores.data ?? []} onSaved={(p) => { setNovas((n) => [...n, p]); setQr(p); }} />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={qr !== null} onOpenChange={(o) => !o && setQr(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="font-display text-2xl">Plaqueta {qr}</DialogTitle></DialogHeader>
          {qr !== null && (
            <div className="flex flex-col items-center gap-2">
              <QrImage value={String(qr)} size={200} />
              <div className="text-sm text-center">{tora?.especie} · Árv. {tora?.arvore} · {tora && fmtM3(Number(tora.volume))} m³</div>
              <Button asChild className="w-full"><Link to="/etiquetas" search={{ p: String(qr) }}><Printer /> Imprimir etiqueta</Link></Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

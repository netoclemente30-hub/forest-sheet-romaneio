import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { romaneiosQuery, torasQuery } from "@/lib/data";
import { fmtM3 } from "@/lib/volume";
import { selecionarToras } from "@/lib/tora-qr";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Warehouse, Factory } from "lucide-react";

export const Route = createFileRoute("/serraria")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Serraria — Manejo Florestal" },
      { name: "description", content: "Pátio de toras da empresa e baixa das toras serradas." },
      { property: "og:title", content: "Serraria — Manejo Florestal" },
      { property: "og:description", content: "Pátio de toras da empresa e baixa das toras serradas." },
    ],
  }),
  component: Serraria,
});

type Aba = "patio" | "serradas";

function Serraria() {
  const qc = useQueryClient();
  const toras = useQuery(torasQuery);
  const roms = useQuery(romaneiosQuery);
  const [aba, setAba] = useState<Aba>("patio");
  const [patio, setPatio] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const romPatio = useMemo(() => new Map((roms.data ?? []).filter((r) => r.recebido_em).map((r) => [r.id, r.patio ?? "Sem pátio"])), [roms.data]);
  const patios = useMemo(() => [...new Set(romPatio.values())].sort(), [romPatio]);
  const recebidas = useMemo(() => (toras.data ?? []).filter((t) => t.romaneio_id && romPatio.has(t.romaneio_id)), [toras.data, romPatio]);
  const lista = useMemo(() => {
    const s = q.trim().toLowerCase();
    return recebidas
      .filter((t) => (aba === "patio" ? !t.serrada_em : !!t.serrada_em))
      .filter((t) => !patio || romPatio.get(t.romaneio_id!) === patio)
      .filter((t) => !s || String(t.plaqueta) === s || (t.especie ?? "").toLowerCase().includes(s) || (t.autex ?? "").toLowerCase() === s)
      .sort((a, b) => b.plaqueta - a.plaqueta);
  }, [recebidas, aba, patio, q, romPatio]);

  async function serrar(desfazer = false) {
    if (!sel.length) return;
    if (!desfazer && !confirm(`Dar baixa de ${sel.length} toras como serradas?`)) return;
    setBusy(true);
    const { error } = await supabase.from("toras").update({ serrada_em: desfazer ? null : new Date().toISOString() }).in("plaqueta", sel);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(desfazer ? `${sel.length} toras voltaram ao pátio` : `${sel.length} toras serradas`);
    setSel([]);
    await qc.invalidateQueries({ queryKey: ["toras"] });
  }

  const vol = lista.reduce((n, t) => n + Number(t.volume), 0);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-3xl font-bold uppercase">Serraria</h1>
        <Button asChild variant="secondary" size="sm"><Link to="/entrada"><Warehouse /> Entrada no pátio</Link></Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant={aba === "patio" ? "default" : "outline"} onClick={() => { setAba("patio"); setSel([]); }}>Pátio de toras</Button>
        <Button variant={aba === "serradas" ? "default" : "outline"} onClick={() => { setAba("serradas"); setSel([]); }}>Serradas</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={!patio ? "default" : "outline"} onClick={() => setPatio("")}>Todos os pátios</Button>
        {patios.map((p) => <Button key={p} size="sm" variant={patio === p ? "default" : "outline"} onClick={() => setPatio(p)}>{p}</Button>)}
      </div>
      <Input placeholder="Buscar plaqueta, espécie ou AUTEX" value={q} onChange={(e) => setQ(e.target.value)} className="h-11" />
      <div className="flex items-center justify-between rounded-lg bg-forest text-primary-foreground px-4 py-3">
        <span className="text-sm opacity-80">{lista.length} toras {aba === "patio" ? "no pátio" : "serradas"}</span>
        <span className="font-display text-3xl font-bold">{fmtM3(vol)} m³</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Selecionar todas" checked={lista.length > 0 && lista.every((t) => sel.includes(t.plaqueta))} onCheckedChange={(v) => setSel((s) => selecionarToras(s, lista.map((t) => t.plaqueta), v === true))} />Selecionar todas</label>
        {aba === "patio"
          ? <Button disabled={busy || !sel.length} onClick={() => serrar()}><Factory /> Serrar ({sel.length})</Button>
          : <Button variant="outline" disabled={busy || !sel.length} onClick={() => serrar(true)}>Voltar ao pátio ({sel.length})</Button>}
      </div>
      <div className="bg-card border rounded-xl divide-y">
        {lista.slice(0, 300).map((t) => (
          <label key={t.plaqueta} className="flex items-center gap-3 p-3 cursor-pointer">
            <Checkbox aria-label={`Selecionar tora ${t.plaqueta}`} checked={sel.includes(t.plaqueta)} onCheckedChange={(v) => setSel((s) => selecionarToras(s, [t.plaqueta], v === true))} />
            <div className="font-display text-xl font-bold w-14">{t.plaqueta}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{t.especie}</div>
              <div className="text-xs text-muted-foreground">Árv. {t.arvore} · Sec. {t.secao ?? "–"} · AUTEX {t.autex ?? "—"} · {romPatio.get(t.romaneio_id!)}{t.serrada_em && ` · serrada ${new Date(t.serrada_em).toLocaleDateString("pt-BR")}`}</div>
            </div>
            <div className="text-sm font-semibold">{fmtM3(Number(t.volume))}</div>
          </label>
        ))}
        {!lista.length && <div className="p-4 text-sm text-muted-foreground">{aba === "patio" ? "Nenhuma tora no pátio. Dê entrada lendo o QR do romaneio." : "Nenhuma tora serrada ainda."}</div>}
      </div>
    </div>
  );
}

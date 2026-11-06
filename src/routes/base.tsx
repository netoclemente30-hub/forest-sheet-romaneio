import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { arvoresQuery, autexQuery, torasQuery, type Arvore } from "@/lib/data";
import { fmtM3 } from "@/lib/volume";
import { chaveArvore } from "@/lib/import-base";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/base")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Base — Manejo Florestal" },
      { name: "description", content: "Ficha de campo do inventário florestal: árvores, CAP, DAP, altura e volume." },
      { property: "og:title", content: "Base — Manejo Florestal" },
      { property: "og:description", content: "Ficha de campo do inventário florestal." },
    ],
  }),
  component: BasePage,
});

type Filtro = "todas" | "exploradas" | "nao" | "encerradas";

function BasePage() {
  const arvores = useQuery(arvoresQuery);
  const toras = useQuery(torasQuery);
  const autex = useQuery(autexQuery);
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [lim, setLim] = useState(100);
  const [verManejos, setVerManejos] = useState(false);
  const [busyAutex, setBusyAutex] = useState("");
  const [editando, setEditando] = useState<Arvore | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busyArvore, setBusyArvore] = useState(false);

  function abrirEdicao(a: Arvore) {
    setForm({
      numero: String(a.numero), nome_vulgar: a.nome_vulgar, nome_cientifico: a.nome_cientifico ?? "",
      cap: a.cap != null ? String(a.cap) : "", dap: a.dap != null ? String(a.dap) : "",
      altura: a.altura != null ? String(a.altura) : "", volume: a.volume != null ? String(a.volume) : "",
      categoria: a.categoria ?? "", picada: a.picada ?? "", autex: a.autex,
    });
    setEditando(a);
  }

  const num = (s: string) => { const n = Number(s.replace(",", ".")); return s.trim() && !isNaN(n) ? n : null; };

  async function salvarEdicao() {
    if (!editando) return;
    const numero = parseInt(form.numero, 10);
    if (!numero || !form.nome_vulgar.trim()) { toast.error("Número e espécie são obrigatórios"); return; }
    setBusyArvore(true);
    const { error } = await supabase.from("arvores").update({
      numero, nome_vulgar: form.nome_vulgar.trim(), nome_cientifico: form.nome_cientifico.trim() || null,
      cap: num(form.cap), dap: num(form.dap), altura: num(form.altura), volume: num(form.volume),
      categoria: form.categoria.trim() || null, picada: form.picada.trim() || null, autex: form.autex.trim(),
    }).eq("id", editando.id);
    setBusyArvore(false);
    if (error) { toast.error(error.message.includes("duplicate") ? "Já existe uma árvore com esse número nessa AUTEX" : error.message); return; }
    await qc.invalidateQueries({ queryKey: ["arvores"] });
    setEditando(null);
    toast.success("Árvore atualizada");
  }

  async function excluirArvore(a: Arvore) {
    if (volExpl.has(chaveArvore(a.numero, a.autex))) {
      toast.error("Essa árvore já tem toras lançadas e não pode ser excluída. Se o manejo acabou, use Encerrar no manejo.");
      return;
    }
    if (!window.confirm(`Excluir a árvore ${a.numero} (${a.nome_vulgar})? Essa ação não pode ser desfeita.`)) return;
    setBusyArvore(true);
    const { error } = await supabase.from("arvores").delete().eq("id", a.id);
    setBusyArvore(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["arvores"] });
    toast.success("Árvore excluída");
  }

  const encerradas = useMemo(() => new Set((autex.data ?? []).filter((a) => a.encerrado).map((a) => a.numero)), [autex.data]);

  async function alternarEncerrado(numero: string, encerrado: boolean) {
    setBusyAutex(numero);
    const { error } = await supabase.from("autex").update({ encerrado: !encerrado }).eq("numero", numero);
    setBusyAutex("");
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["autex"] });
    toast.success(encerrado ? "Manejo reaberto" : "Manejo encerrado e arquivado");
  }

  // Mesma lógica das colunas EXPL. e VOL.EXPL da planilha
  const volExpl = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of toras.data ?? []) { const k = chaveArvore(t.arvore, t.autex); m.set(k, (m.get(k) ?? 0) + Number(t.volume)); }
    return m;
  }, [toras.data]);

  const lista = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (arvores.data ?? []).filter((a) => {
      const enc = encerradas.has(a.autex);
      if (filtro === "encerradas" ? !enc : enc) return false;
      const expl = volExpl.has(chaveArvore(a.numero, a.autex));
      if (filtro === "exploradas" && !expl) return false;
      if (filtro === "nao" && expl) return false;
      if (!s) return true;
      return String(a.numero) === s || a.nome_vulgar.toLowerCase().includes(s) || a.picada === s || a.autex.toLowerCase() === s;
    });
  }, [arvores.data, volExpl, encerradas, q, filtro]);

  const volInv = lista.reduce((n, a) => n + Number(a.volume ?? 0), 0);
  const volEx = lista.reduce((n, a) => n + (volExpl.get(chaveArvore(a.numero, a.autex)) ?? 0), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold uppercase">Base · Ficha de campo</h1>
      <Input placeholder="Buscar nº, espécie, picada ou AUTEX" value={q} onChange={(e) => setQ(e.target.value)} className="h-11" />
      <div className="flex flex-wrap gap-2">
        {(["todas", "exploradas", "nao", "encerradas"] as Filtro[]).map((k) => (
          <Button key={k} size="sm" variant={filtro === k ? "default" : "outline"} onClick={() => setFiltro(k)}>
            {k === "todas" ? "Todas" : k === "exploradas" ? "Exploradas" : k === "nao" ? "Não exploradas" : "Encerradas"}
          </Button>
        ))}
        {isAdmin && (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setVerManejos(!verManejos)}>
            {verManejos ? "Fechar manejos" : "Gerenciar manejos"}
          </Button>
        )}
      </div>
      {isAdmin && verManejos && (
        <div className="bg-card border rounded-xl divide-y">
          <div className="p-3 text-sm font-semibold">Manejos (AUTEX) — encerrar arquiva a base sem apagar nada</div>
          {(autex.data ?? []).map((a) => (
            <div key={a.numero} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{a.numero}{a.descricao && <span className="text-muted-foreground font-normal"> · {a.descricao}</span>}</div>
                {a.encerrado && <div className="text-xs text-muted-foreground">Manejo encerrado · arquivado</div>}
              </div>
              <Button size="sm" variant={a.encerrado ? "outline" : "secondary"} disabled={busyAutex === a.numero} onClick={() => alternarEncerrado(a.numero, a.encerrado)}>
                {a.encerrado ? "Reabrir" : "Encerrar"}
              </Button>
            </div>
          ))}
          {autex.data?.length === 0 && <div className="p-3 text-sm text-muted-foreground">Nenhuma AUTEX cadastrada ainda.</div>}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-card border rounded-lg p-2"><div className="text-xs text-muted-foreground">Árvores</div><div className="font-display text-xl font-bold">{lista.length}</div></div>
        <div className="bg-card border rounded-lg p-2"><div className="text-xs text-muted-foreground">Vol. inventário</div><div className="font-display text-xl font-bold">{fmtM3(volInv)}</div></div>
        <div className="bg-card border rounded-lg p-2"><div className="text-xs text-muted-foreground">Vol. explorado</div><div className="font-display text-xl font-bold">{fmtM3(volEx)}</div></div>
      </div>
      <div className="bg-card border rounded-xl divide-y">
        {lista.slice(0, lim).map((a) => {
          const ve = volExpl.get(chaveArvore(a.numero, a.autex));
          return (
            <div key={a.id} className="p-3">
              <div className="flex items-center gap-3">
                <div className="font-display text-xl font-bold w-14">{a.numero}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.nome_vulgar}{a.nome_cientifico && <span className="text-muted-foreground italic font-normal"> · {a.nome_cientifico}</span>}</div>
                  <div className="text-xs text-muted-foreground">
                    Picada {a.picada ?? "–"} · CAP {a.cap ?? "–"} · DAP {a.dap ? Number(a.dap).toFixed(1) : "–"} · H {a.altura ?? "–"} m · AUTEX {a.autex || "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{fmtM3(Number(a.volume ?? 0))}</div>
                  <div className="text-xs text-muted-foreground">{a.categoria}</div>
                </div>
                {isAdmin && (
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" aria-label={`Editar árvore ${a.numero}`} onClick={() => abrirEdicao(a)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label={`Excluir árvore ${a.numero}`} disabled={busyArvore} onClick={() => excluirArvore(a)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                )}
              </div>
              {ve !== undefined && (
                <div className="mt-1 ml-[4.25rem] text-xs text-success font-semibold">
                  ☑ Explorada · {fmtM3(ve)} m³ ({a.volume ? Math.round((ve / Number(a.volume)) * 100) : 0}% aproveitamento)
                </div>
              )}
            </div>
          );
        })}
        {arvores.isLoading && <div className="p-4 text-sm text-muted-foreground">Carregando…</div>}
        {!arvores.isLoading && lista.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nenhuma árvore. Importe sua planilha pela tela inicial.</div>}
      </div>
      {lista.length > lim && <Button variant="outline" className="w-full" onClick={() => setLim(lim + 200)}>Mostrar mais</Button>}
      <Dialog open={!!editando} onOpenChange={(o) => { if (!o) setEditando(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar árvore {editando?.numero}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Número</Label><Input inputMode="numeric" value={form.numero ?? ""} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></div>
            <div className="space-y-1"><Label>Espécie</Label><Input value={form.nome_vulgar ?? ""} onChange={(e) => setForm({ ...form, nome_vulgar: e.target.value })} /></div>
            <div className="col-span-2 space-y-1"><Label>Nome científico</Label><Input value={form.nome_cientifico ?? ""} onChange={(e) => setForm({ ...form, nome_cientifico: e.target.value })} /></div>
            <div className="space-y-1"><Label>CAP (cm)</Label><Input inputMode="decimal" value={form.cap ?? ""} onChange={(e) => setForm({ ...form, cap: e.target.value })} /></div>
            <div className="space-y-1"><Label>DAP (cm)</Label><Input inputMode="decimal" value={form.dap ?? ""} onChange={(e) => setForm({ ...form, dap: e.target.value })} /></div>
            <div className="space-y-1"><Label>Altura (m)</Label><Input inputMode="decimal" value={form.altura ?? ""} onChange={(e) => setForm({ ...form, altura: e.target.value })} /></div>
            <div className="space-y-1"><Label>Volume (m³)</Label><Input inputMode="decimal" value={form.volume ?? ""} onChange={(e) => setForm({ ...form, volume: e.target.value })} /></div>
            <div className="space-y-1"><Label>Categoria</Label><Input value={form.categoria ?? ""} onChange={(e) => setForm({ ...form, categoria: e.target.value })} /></div>
            <div className="space-y-1"><Label>Picada</Label><Input value={form.picada ?? ""} onChange={(e) => setForm({ ...form, picada: e.target.value })} /></div>
            <div className="col-span-2 space-y-1"><Label>AUTEX</Label><Input value={form.autex ?? ""} onChange={(e) => setForm({ ...form, autex: e.target.value })} /></div>
          </div>
          <Button className="w-full" disabled={busyArvore} onClick={salvarEdicao}>Salvar alterações</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

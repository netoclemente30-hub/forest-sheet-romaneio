import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { arvoresQuery, autexQuery, torasQuery } from "@/lib/data";
import { fmtM3 } from "@/lib/volume";
import { chaveArvore } from "@/lib/import-base";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
      const expl = volExpl.has(chaveArvore(a.numero, a.autex));
      if (filtro === "exploradas" && !expl) return false;
      if (filtro === "nao" && expl) return false;
      if (!s) return true;
      return String(a.numero) === s || a.nome_vulgar.toLowerCase().includes(s) || a.picada === s || a.autex.toLowerCase() === s;
    });
  }, [arvores.data, volExpl, q, filtro]);

  const volInv = lista.reduce((n, a) => n + Number(a.volume ?? 0), 0);
  const volEx = lista.reduce((n, a) => n + (volExpl.get(chaveArvore(a.numero, a.autex)) ?? 0), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold uppercase">Base · Ficha de campo</h1>
      <Input placeholder="Buscar nº, espécie, picada ou AUTEX" value={q} onChange={(e) => setQ(e.target.value)} className="h-11" />
      <div className="flex gap-2">
        {(["todas", "exploradas", "nao"] as Filtro[]).map((k) => (
          <Button key={k} size="sm" variant={filtro === k ? "default" : "outline"} onClick={() => setFiltro(k)}>
            {k === "todas" ? "Todas" : k === "exploradas" ? "Exploradas" : "Não exploradas"}
          </Button>
        ))}
      </div>
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
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { arvoresQuery, autexQuery } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { estaOnline } from "@/lib/offline/sync";
import { fmtM3 } from "@/lib/volume";

export const Route = createFileRoute("/base/$autex")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Ficha de campo do manejo — Manejo Florestal" },
      { name: "description", content: "Ficha de campo vinculada por AUTEX." },
      { property: "og:title", content: "Ficha de campo do manejo — Manejo Florestal" },
      { property: "og:description", content: "Acompanhe a exploração florestal e a localização das árvores por AUTEX." },
    ],
  }),
  component: ManejoPage,
});

function ManejoPage() {
  const { autex: numero } = Route.useParams();
  const arvores = useQuery(arvoresQuery);
  const autex = useQuery(autexQuery);
  const { isAdmin: adminEmpresa, isSuperAdmin } = useAuth();
  const isAdmin = adminEmpresa || isSuperAdmin;
  const qc = useQueryClient();
  const [aba] = useState<"ficha">("ficha");
  const [busy, setBusy] = useState(false);
  const manejo = (autex.data ?? []).find((a) => a.numero === numero);
  const lista = useMemo(() => (arvores.data ?? []).filter((a) => a.autex === numero).sort((a, b) => a.numero - b.numero), [arvores.data, numero]);
  const encerrado = manejo?.encerrado ?? false;

  async function alternarEncerrado() {
    if (!isAdmin) return;
    if (!manejo || busy) return;
    if (!estaOnline()) { toast.error("Precisa de internet para encerrar ou reabrir o manejo"); return; }
    const acao = encerrado ? "reabrir" : "encerrar";
    if (!window.confirm(`Deseja ${acao} o manejo ${numero}? A ficha será preservada.`)) return;
    setBusy(true);
    const { error } = await supabase.from("autex").update({ encerrado: !encerrado }).eq("numero", numero);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["autex"] });
    toast.success(encerrado ? "Manejo reaberto" : "Manejo encerrado e arquivado");
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/base"><ArrowLeft /> Voltar à Base</Link></Button>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Manejo vinculado à ficha de campo</div>
          <h1 className="break-words text-3xl font-bold uppercase">AUTEX {numero}</h1>
          {manejo?.descricao && <p className="text-sm text-muted-foreground">{manejo.descricao}</p>}
          <p className="mt-1 text-sm">{lista.length} árvores · {fmtM3(lista.reduce((n, a) => n + Number(a.volume ?? 0), 0))} m³ no inventário</p>
          {encerrado && <p className="mt-1 text-sm font-semibold text-muted-foreground">Manejo encerrado · histórico preservado para consulta</p>}
        </div>
        {isAdmin && manejo && <Button variant={encerrado ? "outline" : "secondary"} size="sm" disabled={busy} onClick={alternarEncerrado}>{encerrado ? <RotateCcw /> : <Archive />}{encerrado ? "Reabrir" : "Encerrar manejo"}</Button>}
      </header>

      {aba === "ficha" && (
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b p-3 text-sm text-muted-foreground">Esta ficha permanece vinculada à AUTEX {numero}, inclusive depois do encerramento.</div>
          <div className="divide-y">
            {lista.map((a) => <div key={a.id} className="p-3">
              <div className="flex items-start gap-3">
                <div className="w-14 shrink-0 font-display text-xl font-bold">{a.numero}</div>
                <div className="min-w-0 flex-1"><div className="font-semibold">{a.nome_vulgar}</div>{a.nome_cientifico && <div className="text-xs italic text-muted-foreground">{a.nome_cientifico}</div>}<div className="text-xs text-muted-foreground">Picada {a.picada ?? "—"} · CAP {a.cap ?? "—"} · DAP {a.dap ?? "—"} · H {a.altura ?? "—"} m</div></div>
                <div className="text-right text-sm font-semibold">{fmtM3(Number(a.volume ?? 0))}</div>
              </div>
              <div className="ml-[4.25rem] mt-1 text-xs">
                {a.abatida_em && <div className="font-semibold text-destructive">Abatida em {new Date(a.abatida_em).toLocaleString("pt-BR")}</div>}
              </div>
            </div>)}
          </div>
          {arvores.isLoading && <div className="p-4 text-sm text-muted-foreground">Carregando ficha…</div>}
          {!arvores.isLoading && !lista.length && <div className="p-4 text-sm text-muted-foreground">Nenhuma árvore vinculada a esta AUTEX.</div>}
        </section>
      )}
    </div>
  );
}

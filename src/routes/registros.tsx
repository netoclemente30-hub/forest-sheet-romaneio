import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getEmpresaAtiva } from "@/lib/empresa";
import { linkMaps, capturarLog } from "@/lib/registro";
import { modeloDoUserAgent } from "@/lib/aparelho";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { MapPin, Undo2, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { filtrarRegistros, podeReverterRegistro } from "@/lib/registros-lista";
import type { Database, Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
type Registro = Database["public"]["Tables"]["registros"]["Row"];

export const Route = createFileRoute("/registros")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Registros de atividade — Manejo Florestal" },
      { name: "description", content: "Quem lançou cada informação, quando e onde (GPS)." },
      { property: "og:title", content: "Registros de atividade — Manejo Florestal" },
      { property: "og:description", content: "Quem lançou cada informação, quando e onde (GPS)." },
    ],
  }),
  component: Registros,
});

function Registros() {
  const { isAdmin, isSuperAdmin, loading: loadingSessao, permissoesCarregando } = useAuth();
  const loading = loadingSessao || permissoesCarregando;
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [usuario, setUsuario] = useState("todos");
  const [reverter, setReverter] = useState<Registro | null>(null);
  const [busy, setBusy] = useState(false);
  const [limite, setLimite] = useState(50);
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !isAdmin && !isSuperAdmin) nav({ to: "/" });
  }, [loading, isAdmin, isSuperAdmin, nav]);

  const regs = useQuery({
    queryKey: ["registros"],
    enabled: isAdmin || isSuperAdmin,
    queryFn: async () => {
      const todos: Registro[] = [];
      for (let inicio = 0; ; inicio += 1000) {
        let query = supabase.from("registros").select("*").order("numero", { ascending: false }).range(inicio, inicio + 999);
        const emp = getEmpresaAtiva();
        if (emp) query = query.eq("empresa_id", emp);
        const { data, error } = await query;
        if (error) throw error;
        todos.push(...(data ?? []));
        if (!data || data.length < 1000) return todos;
      }
    },
  });

  if (loading || (!isAdmin && !isSuperAdmin)) return null;

  const lista = filtrarRegistros(regs.data ?? [], usuario === "todos" ? "" : usuario, q);
  const usuarios = [...new Set((regs.data ?? []).map((r) => r.user_email).filter((e): e is string => !!e))].sort();
  async function confirmarReversao() {
    if (!reverter || busy) return;
    if (!navigator.onLine) { toast.error("Conecte à internet para reverter com segurança."); return; }
    setBusy(true);
    try {
      const log = await capturarLog("Registro revertido", `Reversão #${reverter.numero}`);
      const { error } = await supabase.rpc("reverter_registro", { _registro: reverter.id, _log: log as unknown as Json });
      if (error) throw error;
      setReverter(null);
      await qc.invalidateQueries();
      toast.success("Registro revertido; a reversão ficou no histórico.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível reverter"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-3xl font-bold uppercase">Registros</h1><Button size="icon" variant="outline" aria-label="Atualizar registros" onClick={() => regs.refetch()}><RefreshCw /></Button></div>
      <Select value={usuario} onValueChange={(v) => { setUsuario(v); setLimite(50); }}><SelectTrigger className="w-full h-11" aria-label="Filtrar por usuário"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os usuários</SelectItem>{usuarios.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select>
      <Input aria-label="Buscar registros" placeholder="Buscar nº, e-mail, aparelho, ação ou detalhe" value={q} onChange={(e) => { setQ(e.target.value); setLimite(50); }} className="h-11" />
      <p className="text-sm text-muted-foreground">{lista.length} registros</p>
      <div className="bg-card border rounded-xl divide-y">
        {lista.slice(0, limite).map((r) => {
          const maps = linkMaps(r.lat, r.lng);
          return (
            <div key={r.id} className="p-3 text-sm space-y-0.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">#{r.numero} · {r.acao}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(r.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
              <div className="text-muted-foreground">{r.detalhe}</div>
              {(r.aparelho_nome || r.aparelho_modelo || r.aparelho_ua) && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground"><Smartphone className="size-3.5 shrink-0" /><span className="break-all">{[r.aparelho_nome, r.aparelho_modelo ?? (r.aparelho_ua ? modeloDoUserAgent(r.aparelho_ua) : null)].filter(Boolean).join(" · ")}</span></div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs break-all">{r.user_email ?? "usuário desconhecido"}</span>
                {maps ? (
                  <a href={maps} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary underline">
                    <MapPin className="size-3.5" /> Ver no mapa
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">sem GPS</span>
                )}
              </div>
              {r.revertido_em ? <p className="text-xs text-muted-foreground">Revertido em {new Date(r.revertido_em).toLocaleString("pt-BR")}</p> : podeReverterRegistro(r) ? <Button size="sm" variant="outline" onClick={() => setReverter(r)}><Undo2 /> Reverter</Button> : !r.reversao_de && <p className="text-xs text-muted-foreground">Sem cópia anterior para reverter</p>}
            </div>
          );
        })}
        {!lista.length && <div className="p-4 text-sm text-muted-foreground">Nenhum registro ainda. Os lançamentos de toras, romaneios e serraria aparecem aqui.</div>}
      </div>
      {lista.length > limite && <Button variant="outline" className="w-full" onClick={() => setLimite((n) => n + 50)}>Mostrar mais</Button>}
      {regs.isError && <p role="alert" className="text-destructive">Não foi possível carregar os registros.</p>}
      <Dialog open={!!reverter} onOpenChange={(o) => !busy && !o && setReverter(null)}><DialogContent><DialogHeader><DialogTitle>Reverter registro #{reverter?.numero}?</DialogTitle><DialogDescription>{reverter?.acao} · {reverter?.detalhe}</DialogDescription></DialogHeader><p className="text-sm">Os dados anteriores serão restaurados somente se não houver alterações posteriores ou números reutilizados. A reversão ficará registrada.</p><Button disabled={busy} onClick={confirmarReversao}><Undo2 />{busy ? "Revertendo…" : "Confirmar reversão"}</Button><Button disabled={busy} variant="outline" onClick={() => setReverter(null)}>Cancelar</Button></DialogContent></Dialog>
    </div>
  );
}

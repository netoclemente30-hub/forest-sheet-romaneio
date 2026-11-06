import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getEmpresaAtiva } from "@/lib/empresa";
import { linkMaps } from "@/lib/registro";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/registros")({
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

  useEffect(() => {
    if (!loading && !isAdmin && !isSuperAdmin) nav({ to: "/" });
  }, [loading, isAdmin, isSuperAdmin, nav]);

  const regs = useQuery({
    queryKey: ["registros"],
    enabled: isAdmin || isSuperAdmin,
    queryFn: async () => {
      let query = supabase.from("registros").select("*").order("criado_em", { ascending: false }).limit(500);
      const emp = getEmpresaAtiva();
      if (emp) query = query.eq("empresa_id", emp);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  if (loading || (!isAdmin && !isSuperAdmin)) return null;

  const s = q.trim().toLowerCase();
  const lista = (regs.data ?? []).filter(
    (r) =>
      !s ||
      (r.user_email ?? "").toLowerCase().includes(s) ||
      r.acao.toLowerCase().includes(s) ||
      (r.detalhe ?? "").toLowerCase().includes(s),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold uppercase">Registros</h1>
      <p className="text-sm text-muted-foreground">Quem lançou cada informação, o horário e o local (GPS) do aparelho.</p>
      <Input placeholder="Buscar por e-mail, ação ou detalhe" value={q} onChange={(e) => setQ(e.target.value)} className="h-11" />
      <div className="bg-card border rounded-xl divide-y">
        {lista.map((r) => {
          const maps = linkMaps(r.lat, r.lng);
          return (
            <div key={r.id} className="p-3 text-sm space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{r.acao}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(r.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
              <div className="text-muted-foreground">{r.detalhe}</div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs">{r.user_email ?? "usuário desconhecido"}</span>
                {maps ? (
                  <a href={maps} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary underline">
                    <MapPin className="size-3.5" /> Ver no mapa
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">sem GPS</span>
                )}
              </div>
            </div>
          );
        })}
        {!lista.length && <div className="p-4 text-sm text-muted-foreground">Nenhum registro ainda. Os lançamentos de toras, romaneios e serraria aparecem aqui.</div>}
      </div>
    </div>
  );
}

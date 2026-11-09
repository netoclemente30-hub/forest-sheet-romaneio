import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { torasQuery, arvoresQuery, romaneiosQuery, autexQuery } from "@/lib/data";
import { fmtM3 } from "@/lib/volume";
import { Truck, Plus, Upload } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Painel — Manejo Florestal" },
      { name: "description", content: "Resumo do inventário, toras no pátio e cargas." },
      { property: "og:title", content: "Painel — Manejo Florestal" },
      { property: "og:description", content: "Resumo do inventário, toras no pátio e cargas." },
    ],
  }),
  component: Index,
});

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-display text-3xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Index() {
  const toras = useQuery(torasQuery);
  const arvores = useQuery(arvoresQuery);
  const autexLista = useQuery(autexQuery);
  const encerradasPainel = new Set((autexLista.data ?? []).filter((a) => a.encerrado).map((a) => a.numero));
  const roms = useQuery(romaneiosQuery);
  const s = useMemo(() => {
    const t = toras.data ?? [];
    const carregadas = t.filter((x) => x.carregada);
    const sum = (a: typeof t) => a.reduce((n, x) => n + Number(x.volume), 0);
    return { total: t.length, vol: sum(t), carr: carregadas.length, volCarr: sum(carregadas), patio: t.length - carregadas.length, volPatio: sum(t) - sum(carregadas) };
  }, [toras.data]);

  const vazio = !toras.isLoading && (toras.data?.length ?? 0) === 0;

  return (
    <div className="space-y-5">
      {vazio && (
        <Link to="/importar" className="block rounded-xl border-2 border-dashed border-primary p-5 text-center">
          <Upload className="mx-auto size-8 text-primary" />
          <div className="font-semibold mt-2">Importar sua planilha</div>
          <div className="text-sm text-muted-foreground">Carregue a BASE e os Cálculos de Inventário do Excel</div>
        </Link>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Árvores (BASE)" value={arvores.data ? String(arvores.data.filter((a) => !encerradasPainel.has(a.autex)).length) : "–"} />
        <Stat label="Toras medidas" value={String(s.total)} sub={`${fmtM3(s.vol)} m³`} />
        <Stat label="No pátio" value={String(s.patio)} sub={`${fmtM3(s.volPatio)} m³`} />
        <Stat label="Carregadas" value={String(s.carr)} sub={`${fmtM3(s.volCarr)} m³`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/romaneio" className="bg-forest text-primary-foreground rounded-xl p-4 flex flex-col gap-2">
          <Truck className="size-7 text-accent" />
          <span className="font-display text-xl font-bold uppercase">Nova carga</span>
        </Link>
        <Link to="/toras" search={{ nova: true }} className="bg-accent text-accent-foreground rounded-xl p-4 flex flex-col gap-2">
          <Plus className="size-7" />
          <span className="font-display text-xl font-bold uppercase">Lançar tora</span>
        </Link>
      </div>
      <div>
        <div className="flex justify-between items-baseline mb-2">
          <h2 className="text-xl font-bold uppercase">Últimas cargas</h2>
          <Link to="/importar" className="text-sm text-primary">Importar planilha</Link>
        </div>
        <div className="space-y-2">
          {(roms.data ?? []).slice(0, 5).map((r) => (
            <Link key={r.id} to="/historico/$id" params={{ id: r.id }} className="flex justify-between bg-card border rounded-lg p-3">
              <div>
                <div className="font-semibold">{r.placa || "Sem placa"}</div>
                <div className="text-xs text-muted-foreground">{new Date(r.data + "T12:00").toLocaleDateString("pt-BR")} · {r.motorista}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{fmtM3(Number(r.total_volume))} m³</div>
                <div className="text-xs text-muted-foreground">{r.qtd_toras} toras</div>
              </div>
            </Link>
          ))}
          {roms.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma carga ainda.</p>}
        </div>
      </div>
    </div>
  );
}

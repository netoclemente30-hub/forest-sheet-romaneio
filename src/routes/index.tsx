import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { torasQuery, arvoresQuery, romaneiosQuery, autexQuery } from "@/lib/data";
import { fmtM3 } from "@/lib/volume";
import { Truck, Plus, Upload, PackageCheck, Factory, Send, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getEmpresaAtiva } from "@/lib/empresa";
import { cargasSerradasQuery, madeiraQuery } from "@/lib/madeira-serrada";
import { rendimentoDesdobro } from "@/lib/relatorios-gerais";
import { hojeLocal, movimentoDoDia } from "@/lib/nfe-txt";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Gestor Florestal · Do manejo à serraria, tudo rastreado" },
      { name: "description", content: "App de manejo florestal: inventário, AUTEX, etiquetas com QR Code, romaneios com TXT NF-e, serraria, relatórios e trabalho offline no mato." },
      { property: "og:title", content: "Gestor Florestal · Do manejo à serraria, tudo rastreado" },
      { property: "og:description", content: "App de manejo florestal: inventário, AUTEX, etiquetas com QR Code, romaneios com TXT NF-e, serraria, relatórios e trabalho offline no mato." },
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
  const { empresaId } = useAuth();
  const empresaAtual = getEmpresaAtiva() ?? empresaId;
  const cargasSer = useQuery(cargasSerradasQuery(empresaAtual));
  const pacotes = useQuery(madeiraQuery(empresaAtual));
  const prod = useMemo(() => {
    const t = toras.data ?? [];
    const r = rendimentoDesdobro(t, pacotes.data ?? [], { inicio: "", fim: "", especie: "" });
    const norm = (x: string | null | undefined) => (x ?? "").trim().toLocaleLowerCase("pt-BR") || "sem espécie";
    const recebido = new Map<string, number>();
    for (const x of t) recebido.set(norm(x.especie), (recebido.get(norm(x.especie)) ?? 0) + Number(x.volume));
    const linhas = r.linhas.map((l) => ({ ...l, recebido: recebido.get(norm(l.especie)) ?? 0 }));
    for (const x of t) {
      const k = norm(x.especie);
      if (!linhas.some((l) => norm(l.especie) === k)) linhas.push({ especie: x.especie?.trim() || "Sem espécie", qtdToras: 0, volToras: 0, pecas: 0, volSerrado: 0, rendimento: null, recebido: recebido.get(k) ?? 0 });
    }
    linhas.sort((a, b) => b.recebido + b.volSerrado - (a.recebido + a.volSerrado));
    const perdas = r.total.volToras > 0 ? Math.max(0, r.total.volToras - r.total.volSerrado) : null;
    return { linhas, total: r.total, perdas };
  }, [toras.data, pacotes.data]);
  const pctTxt = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
  const dia = movimentoDoDia(hojeLocal(), roms.data ?? [], toras.data ?? [], cargasSer.data ?? []);
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
      <div>
        <h2 className="text-sm font-bold uppercase text-muted-foreground mb-2">Hoje</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: PackageCheck, label: "Toras recebidas", v: String(dia.recebidas), sub: `${fmtM3(dia.volRecebido)} m³` },
            { icon: Factory, label: "Volume serrado", v: fmtM3(dia.volSerrado), sub: `m³ · ${dia.serradas} toras` },
            { icon: Send, label: "Cargas expedidas", v: String(dia.cargas), sub: `${fmtM3(dia.volCargas)} m³` },
          ].map(({ icon: Icon, label, v, sub }) => (
            <div key={label} className="bg-forest text-primary-foreground rounded-xl p-3 min-w-0">
              <Icon className="size-5 text-accent" />
              <div className="text-[11px] uppercase leading-tight opacity-80 mt-1">{label}</div>
              <div className="font-display text-2xl font-bold truncate">{v}</div>
              <div className="text-[11px] opacity-80 truncate">{sub}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Árvores inventariadas" value={arvores.data ? String(arvores.data.filter((a) => !encerradasPainel.has(a.autex)).length) : "–"} />
        <Stat label="Volume de toras" value={toras.data ? `${fmtM3(s.vol)}` : "–"} sub={toras.data ? `m³ · ${s.total} toras · pátio ${s.patio}` : undefined} />
        <Stat label="Madeira serrada" value={pacotes.data ? fmtM3(prod.total.volSerrado) : "–"} sub={pacotes.data ? `m³ · ${prod.total.pecas} peças` : undefined} />
        <Stat label="Rendimento" value={pctTxt(prod.total.rendimento)} sub={prod.total.volToras > 0 ? `de ${fmtM3(prod.total.volToras)} m³ serrados` : "sem toras serradas"} />
        <Stat label="Perdas" value={prod.perdas === null ? "—" : fmtM3(prod.perdas)} sub={prod.perdas === null ? "sem toras serradas" : "m³ no desdobro"} />
      </div>
      <div>
        <h2 className="text-sm font-bold uppercase text-muted-foreground mb-2">Produção por essência</h2>
        {prod.linhas.length === 0 ? (
          <p className="bg-card border rounded-xl p-4 text-sm text-muted-foreground">Sem dados de toras ou madeira serrada ainda.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {prod.linhas.map((l) => (
              <div key={l.especie} className="bg-card border rounded-xl p-3 space-y-2">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="font-semibold truncate">{l.especie}</span>
                  <span className="font-display text-lg font-bold text-primary shrink-0">{pctTxt(l.rendimento)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><div className="text-muted-foreground">Toras recebidas</div><div className="font-semibold">{l.recebido > 0 ? `${fmtM3(l.recebido)} m³` : "—"}</div></div>
                  <div><div className="text-muted-foreground">Serrado</div><div className="font-semibold">{l.volSerrado > 0 ? `${fmtM3(l.volSerrado)} m³` : "—"}</div></div>
                </div>
                {l.rendimento !== null && (
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, l.rendimento)}%` }} /></div>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-1">Aproveitamento = madeira serrada ÷ volume das toras serradas da essência.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/romaneio" className="bg-forest text-primary-foreground rounded-xl p-4 flex flex-col gap-2">
          <Truck className="size-7 text-accent" />
          <span className="font-display text-xl font-bold uppercase">Nova carga</span>
        </Link>
        <Link to="/toras" search={{ nova: true }} className="bg-accent text-accent-foreground rounded-xl p-4 flex flex-col gap-2">
          <Plus className="size-7" />
          <span className="font-display text-xl font-bold uppercase">Lançar tora</span>
        </Link>
        <Link to="/serraria" className="bg-card border rounded-xl p-4 flex flex-col gap-2">
          <Factory className="size-7 text-primary" />
          <span className="font-display text-xl font-bold uppercase">Serraria</span>
        </Link>
        <Link to="/relatorios" className="bg-card border rounded-xl p-4 flex flex-col gap-2">
          <BarChart3 className="size-7 text-primary" />
          <span className="font-display text-xl font-bold uppercase">Relatórios</span>
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

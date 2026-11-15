import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { torasQuery, arvoresQuery, romaneiosQuery, autexQuery } from "@/lib/data";
import { fmtM3 } from "@/lib/volume";
import { Truck, Plus, PackageCheck, Factory, Send, TreePine, Scissors, CalendarDays, Tractor } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getEmpresaAtiva } from "@/lib/empresa";
import { cargasSerradasQuery } from "@/lib/madeira-serrada";
import { hojeLocal, movimentoDoDia } from "@/lib/nfe-txt";
import { hojeExploracao, resumoExploracaoDiaria } from "@/lib/exploracao-diaria";
import { arrastosArvoresQuery } from "@/lib/arrasto-arvore";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
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
  const { empresaId, isSuperAdmin } = useAuth();
  const [dataExploracao, setDataExploracao] = useState(hojeExploracao);
  const empresaPainel = getEmpresaAtiva() ?? (isSuperAdmin ? null : empresaId);
  const arrastosArvores = useQuery({ ...arrastosArvoresQuery(empresaPainel ?? ""), enabled: !!empresaPainel || isSuperAdmin });
  const exploracao = useMemo(
    () => resumoExploracaoDiaria(
      dataExploracao, arvores.data ?? [], toras.data ?? [], roms.data ?? [], empresaPainel, arrastosArvores.data ?? [],
    ),
    [dataExploracao, arvores.data, toras.data, roms.data, empresaPainel, arrastosArvores.data],
  );
  const carregandoExploracao = arvores.isLoading || toras.isLoading || roms.isLoading || arrastosArvores.isLoading;
  const erroExploracao = arvores.isError || toras.isError || roms.isError || arrastosArvores.isError;
  const arrastoHabilitado = (toras.data ?? []).some((t) => Object.prototype.hasOwnProperty.call(t, "arrastada_em"));
  const cargasSer = useQuery(cargasSerradasQuery(getEmpresaAtiva() ?? empresaId));
  const dia = movimentoDoDia(hojeLocal(), roms.data ?? [], toras.data ?? [], cargasSer.data ?? []);
  const s = useMemo(() => {
    const t = toras.data ?? [];
    const carregadas = t.filter((x) => x.carregada);
    const sum = (a: typeof t) => a.reduce((n, x) => n + Number(x.volume), 0);
    return { total: t.length, vol: sum(t), carr: carregadas.length, volCarr: sum(carregadas), patio: t.length - carregadas.length, volPatio: sum(t) - sum(carregadas) };
  }, [toras.data]);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold uppercase">Visão Geral · Gestor Florestal</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe o manejo e a serraria da sua empresa: toras medidas e etiquetadas com QR Code, estoque no pátio, cargas expedidas e movimento do dia — tudo rastreado da floresta ao romaneio.
        </p>
      </header>
      <section aria-label="Exploração diária" className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold uppercase">Exploração diária</h2>
            <p className="text-xs text-muted-foreground">Abatimentos, traçamento e cargas de madeira em tora por dia.</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="size-4" />
            <span className="sr-only">Data da exploração</span>
            <Input
              aria-label="Data da exploração"
              type="date"
              value={dataExploracao}
              max={hojeExploracao()}
              onChange={(e) => setDataExploracao(e.target.value)}
              className="h-10 w-[156px] bg-background"
            />
          </label>
        </div>
        {erroExploracao && (
          <p role="alert" className="text-xs text-destructive">
            Não foi possível atualizar todos os registros. Confira a conexão e a sincronização do aparelho.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { icon: TreePine, label: "Árvores abatidas", valor: exploracao.abatidas, detalhe: "Abatidas no mapa", to: "/cortador" as const, indisponivel: false },
            { icon: Scissors, label: "Toras traçadas", valor: exploracao.tracadas, detalhe: exploracao.arvoresTracadas + " árvores de origem", to: "/toras" as const, indisponivel: false },
            { icon: Tractor, label: "Árvores arrastadas", valor: exploracao.arvoresArrastadas, detalhe: exploracao.arrastosAguardandoAbate + " aguardando conciliação do abate", to: "/cortador" as const, indisponivel: false },
            { icon: Tractor, label: "Toras arrastadas", valor: exploracao.arrastadas, detalhe: arrastoHabilitado ? fmtM3(exploracao.volumeArrastado) + " m³ arrastados" : "Aguardando ativação no banco", to: "/cortador" as const, indisponivel: !arrastoHabilitado },
            { icon: Truck, label: "Carregadas para serraria", valor: exploracao.carregadas, detalhe: exploracao.cargas + " romaneios do dia", to: "/historico" as const, indisponivel: false },
          ].map(({ icon: Icon, label, valor, detalhe, to, indisponivel }) => (
            <Link
              to={to}
              key={label}
              className="flex items-start gap-3 rounded-lg border bg-background p-3 transition-colors hover:border-primary/60"
              aria-label={label + ": " + (carregandoExploracao || erroExploracao ? "carregando" : indisponivel ? "não habilitado" : valor)}
            >
              <Icon className="mt-1 size-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-tight">{label}</p>
                <p className="font-display text-3xl font-bold tabular-nums">
                  {carregandoExploracao || erroExploracao || indisponivel ? "—" : valor}
                </p>
                <p className="text-xs text-muted-foreground">{detalhe}</p>
              </div>
            </Link>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Abatidas: data do abate no GPS. Traçadas: data do lançamento da tora de manejo.
          Árvores arrastadas: registro do tratorista, mesmo antes do traçamento. Toras arrastadas: plaquetas vinculadas ao arrasto. Carregadas: toras de manejo vinculadas a romaneios da data selecionada.
          Os totais consideram os registros sincronizados e o horário de Rondônia.
        </p>
      </section>
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

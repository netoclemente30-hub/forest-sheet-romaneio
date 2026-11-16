import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MapPin, Warehouse, Plus, Crosshair, ChevronDown, ChevronUp, ArrowRightLeft, Truck, Trees } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { pode } from "@/lib/funcoes";
import { getEmpresaAtiva } from "@/lib/empresa";
import { autexQuery, torasQuery, type Tora } from "@/lib/data";
import { arrastosArvoresQuery } from "@/lib/arrasto-arvore";
import { cadastrarExplanada, listarExplanadas, type Explanada } from "@/lib/explanadas";
import { resumoExplanada, torasDaExplanada, toraDisponivelExplanada } from "@/lib/explanadas-estoque";
import { transferirToraExplanada } from "@/lib/explanadas-transferir";
import { useFilaOffline } from "@/hooks/useFilaOffline";
import { fmtM3 } from "@/lib/volume";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/explanadas")({
  staticData: { sitemap: false },
  component: ExplanadasPage,
});

function ExplanadasPage() {
  const { empresaId, papel, isSuperAdmin } = useAuth();
  // "Todas as empresas" não pode abrir um pátio operacional.
  const empresa = (isSuperAdmin ? getEmpresaAtiva() : empresaId) ?? "";
  const podeCriar = pode(papel, "patios_criar");
  const podeTransferir = pode(papel, "toras_lancar");
  const [nome, setNome] = useState("");
  const [autex, setAutex] = useState("");
  const [gps, setGps] = useState<{ latitude: number; longitude: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [movendo, setMovendo] = useState(false);
  const [plaquetaTransferir, setPlaquetaTransferir] = useState<number | null>(null);
  const [destinoId, setDestinoId] = useState("");

  const qc = useQueryClient();
  const autorizacoes = useQuery(autexQuery);
  const cadastradas = useQuery({
    queryKey: ["explanadas", empresa],
    queryFn: () => listarExplanadas(empresa),
    enabled: !!empresa,
    networkMode: "always",
  });
  const toras = useQuery({ ...torasQuery, enabled: !!empresa });
  const arrastos = useQuery({
    ...arrastosArvoresQuery(empresa),
    enabled: !!empresa,
  });
  const filaOffline = useFilaOffline();
  const torasEmpresa = useMemo(() =>
    (toras.data ?? []).filter((t) => t.empresa_id === empresa),
  [toras.data, empresa]);
  const arrastosEmpresa = useMemo(() =>
    (arrastos.data ?? []).filter((a) => a.empresa_id === empresa),
  [arrastos.data, empresa]);
  const estoqueIndisponivel = toras.isError || arrastos.isError;
  const estoqueCarregando = toras.isLoading || arrastos.isLoading;
  const autexes = (autorizacoes.data ?? []).filter((a) =>
    !a.encerrado && a.empresa_id === empresa,
  );

  function capturarGPS() {
    if (!navigator.geolocation) { toast.error("GPS indisponível neste dispositivo"); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      setGps({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      toast.success("Localização da explanada capturada");
    }, () => toast.error("Não foi possível capturar o GPS"), {
      enableHighAccuracy: true, timeout: 20000, maximumAge: 0,
    });
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!podeCriar || !empresa || !autex || busy) return;
    setBusy(true);
    try {
      await cadastrarExplanada({
        empresa, autex, nome,
        latitude: gps?.latitude ?? null,
        longitude: gps?.longitude ?? null,
      });
      setNome("");
      setGps(null);
      await qc.invalidateQueries({ queryKey: ["explanadas", empresa] });
      toast.success("Explanada cadastrada para esta AUTEX");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao cadastrar explanada");
    } finally {
      setBusy(false);
    }
  }

  function abrirExplanada(id: string) {
    setAberta((atual) => atual === id ? null : id);
    setPlaquetaTransferir(null);
    setDestinoId("");
  }

  async function confirmarTransferencia(tora: Tora, origem: Explanada) {
    if (!podeTransferir || !empresa || !destinoId || movendo || estoqueIndisponivel) return;
    const destino = (cadastradas.data ?? []).find((x) =>
      x.empresa_id === empresa && x.autex === origem.autex && x.id === destinoId);
    if (!destino) { toast.error("Escolha uma explanada da mesma empresa e AUTEX"); return; }
    if (!window.confirm(
      "Transferir a tora " + tora.plaqueta +
      " da " + origem.nome + " para " + destino.nome +
      "?\n\nA mudança será registrada no histórico e não altera as medidas da tora."
    )) return;

    setMovendo(true);
    try {
      const resultado = await transferirToraExplanada(tora, origem, destino);
      if (resultado.offline) {
        toast.info("Transferência guardada neste aparelho. Aguardando sincronização.");
      } else {
        await qc.invalidateQueries({ queryKey: torasQuery.queryKey });
        toast.success("Tora " + tora.plaqueta + " transferida para " + destino.nome);
      }
      setPlaquetaTransferir(null);
      setDestinoId("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível transferir a tora");
    } finally {
      setMovendo(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold uppercase"><Warehouse /> Pátios / Explanadas</h1>
        <p className="text-sm text-muted-foreground">
          Abra uma explanada para conferir as toras disponíveis, o volume em m³,
          as toras já carregadas e os fustes que ainda precisam ser traçados.
        </p>
      </header>

      {!empresa && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">
        Selecione uma empresa no topo antes de consultar ou cadastrar explanadas.
      </p>}

      {cadastradas.isError && <p role="alert" className="rounded-md border p-3 text-sm">
        Não foi possível consultar as explanadas. Confira a conexão ou as permissões da empresa.
      </p>}

      {podeCriar && !!empresa && (
        <form onSubmit={(e) => void criar(e)} className="space-y-3 rounded-xl border bg-card p-3">
          <h2 className="font-semibold">Cadastrar nova explanada</h2>
          <label className="block text-sm font-medium">AUTEX
            <select aria-label="AUTEX da explanada" value={autex} onChange={(e) => setAutex(e.target.value)}
              className="mt-1 h-11 w-full rounded-md border bg-background px-3" required>
              <option value="">Selecione o manejo</option>
              {autexes.map((a) => <option key={a.numero} value={a.numero}>{a.numero}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Nome da explanada
            <Input className="mt-1" required minLength={2} maxLength={80}
              placeholder="Ex.: Explanada 01 — Picada 04" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <Button type="button" variant="outline" onClick={capturarGPS} className="w-full">
            <Crosshair /> {gps ? "Atualizar GPS da explanada" : "Registrar GPS da explanada (opcional)"}
          </Button>
          {gps && <p className="text-xs text-muted-foreground">
            <MapPin className="inline size-3" /> {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)}
          </p>}
          <Button className="w-full" type="submit"
            disabled={busy || cadastradas.isError || !autex || !empresa}>
            <Plus /> {busy ? "Salvando…" : "Criar explanada"}
          </Button>
        </form>
      )}

      <section className="rounded-xl border bg-card">
        <h2 className="border-b p-3 font-semibold">
          Explanadas cadastradas ({cadastradas.data?.length ?? 0})
        </h2>
        {estoqueIndisponivel && !!empresa && (
          <p role="alert" className="m-3 rounded-md border p-3 text-sm text-destructive">
            Não foi possível consultar o estoque das explanadas. Atualize após conectar;
            não faça transferências antes de confirmar os dados.
          </p>
        )}
        <div className="divide-y">
          {(cadastradas.data ?? []).map((explanada) => {
            const ts = torasDaExplanada(torasEmpresa, explanada);
            const resumo = resumoExplanada(explanada, torasEmpresa, arrastosEmpresa);
            const expandida = aberta === explanada.id;
            const destinos = (cadastradas.data ?? []).filter((x) =>
              x.empresa_id === explanada.empresa_id &&
              x.autex === explanada.autex &&
              x.id !== explanada.id);
            return (
              <article key={explanada.id} className="space-y-0">
                <button type="button" aria-expanded={expandida}
                  aria-controls={"detalhes-explanada-" + explanada.id}
                  onClick={() => abrirExplanada(explanada.id)}
                  className="flex w-full items-center gap-2 p-3 text-left hover:bg-muted/50">
                  <Warehouse className="size-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block font-semibold">{explanada.nome}</span>
                    <span className="block text-xs text-muted-foreground">
                      AUTEX {explanada.autex} · {explanada.latitude == null ? "Sem GPS" : "GPS cadastrado"}
                    </span>
                    <span className="block text-sm">
                      {estoqueCarregando || estoqueIndisponivel ? "Conferindo estoque…" :
                        <><b>{resumo.disponiveis}</b> toras disponíveis · <b>{fmtM3(resumo.volumeDisponivel)} m³</b>
                          {resumo.carregadas > 0 && <span className="text-muted-foreground"> · {resumo.carregadas} carregadas</span>}
                          {resumo.fustesSemToras > 0 && <span className="text-muted-foreground"> · {resumo.fustesSemToras} fustes a traçar</span>}</>}
                    </span>
                  </span>
                  {expandida ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
                </button>

                {expandida && (
                  <div id={"detalhes-explanada-" + explanada.id}
                    className="space-y-3 border-t bg-secondary/25 p-3">
                    <h3 className="font-semibold">Toras da {explanada.nome}</h3>
                    {estoqueCarregando && <p className="text-sm text-muted-foreground">Carregando toras…</p>}
                    {!estoqueCarregando && !estoqueIndisponivel && (
                      <>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="rounded-md border bg-background p-2"><b className="block text-lg">{resumo.disponiveis}</b>Disponíveis</div>
                          <div className="rounded-md border bg-background p-2"><b className="block text-lg">{resumo.carregadas}</b>Carregadas</div>
                          <div className="rounded-md border bg-background p-2"><b className="block text-lg">{resumo.fustesSemToras}</b>Fustes a traçar</div>
                        </div>
                        <p className="text-sm font-medium">Volume disponível: {fmtM3(resumo.volumeDisponivel)} m³</p>
                        {!ts.length && <p className="text-sm text-muted-foreground">
                          Nenhuma tora vinculada a esta explanada. Arrastos sem traçamento são mostrados separadamente.
                        </p>}
                        {ts.map((t) => {
                          const disponivel = toraDisponivelExplanada(t);
                          const pendencia = filaOffline.itens.find(({ op }) =>
                            op.tipo === "transferencia_explanada" &&
                            op.empresa_id === empresa &&
                            op.autex === explanada.autex &&
                            op.plaqueta === t.plaqueta);
                          const destinoPendente = pendencia?.op.tipo === "transferencia_explanada"
                            ? (cadastradas.data ?? []).find((x) => x.id === pendencia.op.destino_id)?.nome
                            : null;
                          const editando = plaquetaTransferir === t.plaqueta;
                          return (
                            <div key={t.plaqueta} className="space-y-2 rounded-lg border bg-background p-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold">Plaqueta {t.plaqueta} · Secção {t.secao || "—"}</p>
                                  <p className="text-sm">{t.especie || "Espécie não cadastrada"} · Árvore {t.arvore}</p>
                                  <p className="text-sm font-medium">{fmtM3(Number(t.volume))} m³</p>
                                </div>
                                <span className="rounded-md bg-secondary px-2 py-1 text-xs">
                                  {t.carregada || t.romaneio_id ? <><Truck className="inline size-3" /> Já carregada</> :
                                    disponivel ? "No pátio" : "Não disponível"}
                                </span>
                              </div>
                              {pendencia && (
                                <p role="status" className="text-xs font-medium">
                                  {pendencia.erro
                                    ? "Transferência com erro — consulte os lançamentos pendentes"
                                    : "Transferência para " + (destinoPendente ?? "outra explanada") + " aguardando sincronização"}
                                </p>
                              )}
                              {podeTransferir && disponivel && !pendencia && destinos.length > 0 &&
                                !estoqueIndisponivel && (
                                editando ? (
                                  <div className="space-y-2 rounded-md bg-secondary/60 p-2">
                                    <label className="block text-xs font-semibold">Explanada de destino
                                      <select aria-label={"Destino da tora " + t.plaqueta}
                                        value={destinoId} onChange={(e) => setDestinoId(e.target.value)}
                                        className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm">
                                        <option value="">Selecione a explanada</option>
                                        {destinos.map((destino) => <option key={destino.id} value={destino.id}>{destino.nome}</option>)}
                                      </select>
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                      <Button type="button" size="sm" disabled={!destinoId || movendo}
                                        onClick={() => void confirmarTransferencia(t, explanada)}>
                                        <ArrowRightLeft className="size-4" /> {movendo ? "Transferindo…" : "Confirmar transferência"}
                                      </Button>
                                      <Button type="button" size="sm" variant="outline" disabled={movendo}
                                        onClick={() => { setPlaquetaTransferir(null); setDestinoId(""); }}>Cancelar</Button>
                                    </div>
                                  </div>
                                ) : <Button type="button" size="sm" variant="outline"
                                  onClick={() => { setPlaquetaTransferir(t.plaqueta); setDestinoId(""); }}>
                                  <ArrowRightLeft className="size-4" /> Transferir tora
                                </Button>
                              )}
                              {podeTransferir && disponivel && destinos.length === 0 &&
                                <p className="text-xs text-muted-foreground">
                                  Cadastre outra explanada na mesma AUTEX para transferir esta tora.
                                </p>}
                            </div>
                          );
                        })}
                        {!!resumo.outrasSaidas && <p className="text-xs text-muted-foreground">
                          {resumo.outrasSaidas} tora(s) vinculada(s) sem disponibilidade para transferência.
                        </p>}
                        {!!resumo.fustesSemToras && <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Trees className="size-4" /> Os fustes aguardando traçamento não contam como toras medidas.
                        </p>}
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
          {cadastradas.isSuccess && !cadastradas.data.length &&
            <p className="p-4 text-sm text-muted-foreground">Nenhuma explanada cadastrada para esta empresa.</p>}
        </div>
      </section>
      <p className="text-xs text-muted-foreground">
        Transferências são auditadas por plaqueta, empresa e AUTEX. Se feitas offline,
        só alteram o saldo oficial depois da sincronização.
      </p>
    </div>
  );
}

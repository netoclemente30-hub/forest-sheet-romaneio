import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crosshair, MapPin, Navigation, Play, Square, TreePine } from "lucide-react";
import { arvoresQuery, rastrosQuery, type Arvore } from "@/lib/data";
import { useAuth } from "@/hooks/useAuth";
import { getEmpresaAtiva } from "@/lib/empresa";
import {
  aceitarPontoRastro,
  comprimentoRastro,
  coordenadaValida,
  mesclarRastros,
  pontoDaArvore,
  projetarMapa,
  type Coordenada,
  type PontoRastro,
} from "@/lib/exploracao";
import {
  carregarRastroAtivo,
  guardarRastroAtivo,
  persistirArvoreLocal,
  persistirRastroLocal,
  salvarArvoreGPS,
  salvarRastro,
} from "@/lib/exploracao-salvar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function textoErroGps(codigo: number): string {
  if (codigo === 1) return "Permita o acesso à localização do aparelho para usar o mapa";
  if (codigo === 3) return "O GPS demorou para responder. Vá para um lugar aberto e tente novamente";
  return "GPS indisponível. Ative a localização do aparelho e tente novamente";
}

export function MapaExploracao({ autex, arvores, encerrado }: { autex: string; arvores: Arvore[]; encerrado: boolean }) {
  const qc = useQueryClient();
  const { empresaId, session } = useAuth();
  const empresa = getEmpresaAtiva() ?? empresaId;
  const rastros = useQuery({ ...rastrosQuery(autex), enabled: !!autex });
  const [atual, setAtual] = useState<Coordenada | null>(null);
  const [pontosAtivos, setPontosAtivos] = useState<PontoRastro[]>([]);
  const [sessaoId, setSessaoId] = useState("");
  const [rastreando, setRastreando] = useState(false);
  const [statusGps, setStatusGps] = useState("O rastreio funciona sem internet usando o GPS do aparelho");
  const [selecionada, setSelecionada] = useState("");
  const [editando, setEditando] = useState<Arvore | null>(null);
  const [posicaoEdicao, setPosicaoEdicao] = useState<Coordenada | null>(null);
  const [busy, setBusy] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const carregou = useRef("");

  useEffect(() => {
    if (!empresa) return;
    const chave = `${empresa}:${autex}`;
    if (carregou.current === chave) return;
    carregou.current = chave;
    void carregarRastroAtivo(empresa, autex).then((pontos) => {
      if (!pontos.length) return;
      setPontosAtivos(pontos);
      setSessaoId(pontos[0]?.sessao_id ?? crypto.randomUUID());
      setRastreando(!encerrado);
      setStatusGps(encerrado ? "Há um rastro interrompido neste aparelho; encerre-o para guardar" : "Rastreio anterior retomado");
    });
  }, [empresa, autex, encerrado]);

  useEffect(() => {
    if (!rastreando || !empresa || encerrado || !sessaoId) return;
    if (!navigator.geolocation) {
      setStatusGps("Este aparelho não oferece GPS pelo navegador");
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        const coordenada: Coordenada = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          precisao: p.coords.accuracy,
          capturado_em: new Date(p.timestamp).toISOString(),
        };
        setAtual(coordenada);
        setStatusGps(`GPS ativo · precisão de ${Math.round(p.coords.accuracy)} m`);
        setPontosAtivos((anteriores) => {
          const ultimo = anteriores.at(-1);
          if (!aceitarPontoRastro(ultimo, coordenada)) return anteriores;
          return [...anteriores, {
            id: crypto.randomUUID(),
            empresa_id: empresa,
            autex,
            sessao_id: sessaoId,
            lat: coordenada.lat,
            lng: coordenada.lng,
            precisao: coordenada.precisao ?? null,
            capturado_em: coordenada.capturado_em!,
            user_id: session?.user.id ?? null,
          }];
        });
      },
      (erro) => setStatusGps(textoErroGps(erro.code)),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [rastreando, empresa, autex, encerrado, sessaoId, session?.user.id]);

  useEffect(() => {
    if (rastreando && empresa && pontosAtivos.length) void guardarRastroAtivo(empresa, autex, pontosAtivos);
  }, [rastreando, empresa, autex, pontosAtivos]);

  const localizadas = useMemo(() => arvores.filter((a) => pontoDaArvore(a)), [arvores]);
  const abatidas = useMemo(() => arvores.filter((a) => a.abatida_em), [arvores]);
  const todosPontos = useMemo(() => mesclarRastros(rastros.data ?? [], pontosAtivos), [rastros.data, pontosAtivos]);
  const distanciaAtiva = comprimentoRastro(pontosAtivos);

  const projecao = useMemo(() => {
    const pontos = [
      ...localizadas.map((a) => pontoDaArvore(a)!),
      ...todosPontos.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng })),
      ...(atual ? [{ id: "posicao-atual", lat: atual.lat, lng: atual.lng }] : []),
    ];
    return new Map(projetarMapa(pontos).map((p) => [p.ponto.id, p]));
  }, [localizadas, todosPontos, atual]);

  const percursos = useMemo(() => {
    const grupos = new Map<string, PontoRastro[]>();
    for (const ponto of todosPontos) {
      const chave = ponto.sessao_id ?? "antigo";
      grupos.set(chave, [...(grupos.get(chave) ?? []), ponto]);
    }
    return [...grupos.values()].map((pontos) => pontos.map((p) => projecao.get(p.id)).filter(Boolean).map((p) => `${p!.x},${p!.y}`).join(" ")).filter((p) => p.includes(" "));
  }, [todosPontos, projecao]);

  function iniciarRastreio() {
    if (!empresa) { toast.error("Aguarde carregar a empresa"); return; }
    if (!navigator.geolocation) { toast.error("Este aparelho não oferece GPS pelo navegador"); return; }
    setSessaoId(crypto.randomUUID());
    setPontosAtivos([]);
    setAtual(null);
    setRastreando(true);
    setStatusGps("Procurando sinal de GPS…");
  }

  async function encerrarRastreio() {
    if (!empresa || busy) return;
    setRastreando(false);
    if (!pontosAtivos.length) {
      await guardarRastroAtivo(empresa, autex, []);
      toast.error("Nenhum ponto foi capturado; tente novamente em área aberta");
      return;
    }
    setBusy(true);
    try {
      const resultado = await salvarRastro({ empresa, autex, pontos: pontosAtivos });
      const atualizados = await persistirRastroLocal(rastros.data ?? [], autex, pontosAtivos);
      qc.setQueryData(rastrosQuery(autex).queryKey, atualizados);
      await guardarRastroAtivo(empresa, autex, []);
      setPontosAtivos([]);
      setSessaoId("");
      setStatusGps(resultado.offline ? "Rastro guardado no aparelho; será enviado quando conectar" : "Rastro salvo e compartilhado com a empresa");
      toast.success(resultado.offline ? "Rastro salvo offline" : "Rastro salvo");
      if (!resultado.offline) await qc.invalidateQueries({ queryKey: rastrosQuery(autex).queryKey });
    } catch (error) {
      setRastreando(true);
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o rastro");
    } finally {
      setBusy(false);
    }
  }

  function abrirArvore(a: Arvore) {
    setEditando(a);
    setPosicaoEdicao(a.latitude != null && a.longitude != null ? { lat: Number(a.latitude), lng: Number(a.longitude), precisao: a.gps_precisao == null ? null : Number(a.gps_precisao) } : null);
  }

  function capturarPosicao() {
    if (!navigator.geolocation) { toast.error("Este aparelho não oferece GPS pelo navegador"); return; }
    setCapturando(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosicaoEdicao({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy, capturado_em: new Date(p.timestamp).toISOString() });
        setCapturando(false);
      },
      (erro) => { setCapturando(false); toast.error(textoErroGps(erro.code)); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }

  async function registrarArvore(abatida: boolean | null) {
    if (!editando || !empresa || !posicaoEdicao || busy) return;
    if (!coordenadaValida(posicaoEdicao.lat, posicaoEdicao.lng)) { toast.error("Posição GPS inválida"); return; }
    if (abatida === true && !window.confirm(`Confirmar que a árvore ${editando.numero} foi abatida nesta posição?`)) return;
    if (abatida === false && !window.confirm(`Desfazer o abatimento da árvore ${editando.numero}? A localização será mantida.`)) return;
    setBusy(true);
    try {
      const resultado = await salvarArvoreGPS({ arvore: editando, empresa, posicao: posicaoEdicao, abatida });
      const atualizadas = await persistirArvoreLocal(arvoresQuery ? qc.getQueryData<Arvore[]>(arvoresQuery.queryKey) ?? arvores : arvores, editando.id, resultado.op.dados);
      qc.setQueryData(arvoresQuery.queryKey, atualizadas);
      const nova = { ...editando, ...resultado.op.dados };
      setEditando(nova);
      setSelecionada(nova.id);
      toast.success(resultado.offline ? "Registro salvo offline" : abatida === true ? "Árvore abatida registrada" : abatida === false ? "Abatimento desfeito" : "Localização salva");
      if (!resultado.offline) await qc.invalidateQueries({ queryKey: arvoresQuery.queryKey });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a árvore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border bg-card p-2"><div className="text-xs text-muted-foreground">Localizadas</div><div className="font-display text-xl font-bold">{localizadas.length}/{arvores.length}</div></div>
        <div className="rounded-lg border bg-card p-2"><div className="text-xs text-muted-foreground">Abatidas</div><div className="font-display text-xl font-bold">{abatidas.length}</div></div>
        <div className="rounded-lg border bg-card p-2"><div className="text-xs text-muted-foreground">Percurso atual</div><div className="font-display text-xl font-bold">{Math.round(distanciaAtiva)} m</div></div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-2 border-b p-3 text-xs text-muted-foreground">
          <span>Mapa GPS offline · norte para cima</span>
          <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-primary" /> em pé <span className="ml-2 inline-block size-2 rounded-full bg-destructive" /> abatida</span>
        </div>
        <svg viewBox="0 0 640 420" className="h-[360px] w-full touch-manipulation sm:h-[420px]" role="img" aria-label={`Mapa exploratório da AUTEX ${autex}`}>
          <rect width="640" height="420" fill="var(--color-muted)" />
          {[80, 160, 240, 320, 400, 480, 560].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="420" stroke="var(--color-border)" strokeWidth="1" />)}
          {[70, 140, 210, 280, 350].map((y) => <line key={y} x1="0" y1={y} x2="640" y2={y} stroke="var(--color-border)" strokeWidth="1" />)}
          {percursos.map((pontos, i) => <polyline key={i} points={pontos} fill="none" stroke="var(--color-accent)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />)}
          {localizadas.map((a) => {
            const p = projecao.get(a.id);
            if (!p) return null;
            return (
              <g key={a.id} role="button" tabIndex={0} aria-label={`Árvore ${a.numero}, ${a.nome_vulgar}${a.abatida_em ? ", abatida" : ""}`} className="cursor-pointer" onClick={() => abrirArvore(a)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") abrirArvore(a); }}>
                <circle cx={p.x} cy={p.y} r="12" fill={a.abatida_em ? "var(--color-destructive)" : "var(--color-primary)"} stroke="var(--color-card)" strokeWidth="3" />
                <text x={p.x + 15} y={p.y + 4} fontSize="12" fontWeight="700" fill="var(--color-foreground)">{a.numero}</text>
              </g>
            );
          })}
          {atual && projecao.get("posicao-atual") && <g aria-label="Sua posição atual"><circle cx={projecao.get("posicao-atual")!.x} cy={projecao.get("posicao-atual")!.y} r="14" fill="var(--color-accent)" stroke="var(--color-card)" strokeWidth="4" /><Navigation x={projecao.get("posicao-atual")!.x - 7} y={projecao.get("posicao-atual")!.y - 7} width="14" height="14" color="var(--color-accent-foreground)" /></g>}
          {!localizadas.length && !todosPontos.length && !atual && <text x="320" y="205" textAnchor="middle" fontSize="16" fill="var(--color-muted-foreground)">Inicie o rastreio ou localize uma árvore pelo GPS</text>}
          <text x="608" y="36" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--color-foreground)">N</text>
          <path d="M608 44 L598 68 L608 62 L618 68 Z" fill="var(--color-foreground)" />
        </svg>
      </div>

      <div role="status" className="rounded-lg bg-secondary px-3 py-2 text-sm">{statusGps}</div>
      {rastreando || pontosAtivos.length ? (
        <Button className="w-full" variant="secondary" disabled={busy} onClick={encerrarRastreio}><Square /> {busy ? "Salvando rastro…" : `Encerrar e salvar rastro (${pontosAtivos.length} pontos)`}</Button>
      ) : !encerrado ? (
        <Button className="w-full" onClick={iniciarRastreio}><Play /> Iniciar rastreio GPS</Button>
      ) : null}
      <p className="text-xs text-muted-foreground">Durante o rastreio, mantenha o aplicativo aberto e a tela ligada. O GPS continua funcionando sem sinal de celular.</p>

      {!encerrado && <section className="space-y-3 rounded-xl border bg-card p-3">
        <div><h2 className="text-xl font-bold">Localizar ou registrar abatimento</h2><p className="text-sm text-muted-foreground">Escolha uma árvore da ficha e confirme a posição no local.</p></div>
        <div className="flex gap-2">
          <select aria-label="Árvore para localizar" className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" value={selecionada} onChange={(e) => setSelecionada(e.target.value)}>
            <option value="">Selecione número ou espécie</option>
            {[...arvores].sort((a, b) => a.numero - b.numero).map((a) => <option key={a.id} value={a.id}>{a.numero} · {a.nome_vulgar}{a.abatida_em ? " · abatida" : a.latitude != null ? " · localizada" : ""}</option>)}
          </select>
          <Button aria-label="Abrir registro da árvore" disabled={!selecionada} onClick={() => { const a = arvores.find((x) => x.id === selecionada); if (a) abrirArvore(a); }}><MapPin /></Button>
        </div>
      </section>}

      {arvores.some((a) => a.latitude == null) && <section className="rounded-xl border bg-card">
        <div className="border-b p-3"><h2 className="font-semibold">Árvores da ficha ainda sem posição</h2><p className="text-xs text-muted-foreground">A ficha continua vinculada; registre a posição ao encontrar cada árvore.</p></div>
        <div className="divide-y">
          {arvores.filter((a) => a.latitude == null).slice(0, 12).map((a) => <div key={a.id} className="flex items-center gap-3 p-3"><TreePine className="size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><div className="font-semibold">Árvore {a.numero} · {a.nome_vulgar}</div><div className="text-xs text-muted-foreground">Picada {a.picada ?? "—"}</div></div>{!encerrado && <Button size="sm" variant="outline" onClick={() => abrirArvore(a)}><Crosshair /> GPS</Button>}</div>)}
        </div>
        {arvores.filter((a) => a.latitude == null).length > 12 && <div className="p-3 text-xs text-muted-foreground">Use a seleção acima para localizar as demais {arvores.filter((a) => a.latitude == null).length - 12} árvores.</div>}
      </section>}

      <Dialog open={!!editando} onOpenChange={(open) => { if (!open && !busy) setEditando(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Árvore {editando?.numero} · {editando?.nome_vulgar}</DialogTitle>
            <DialogDescription>AUTEX {autex} · Picada {editando?.picada ?? "—"}</DialogDescription>
          </DialogHeader>
          {editando && <div className="space-y-4">
            {editando.abatida_em && <div className="rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground">Abatida em {new Date(editando.abatida_em).toLocaleString("pt-BR")}</div>}
            <div className="rounded-lg bg-secondary p-3 text-sm">
              {posicaoEdicao ? <><div className="font-semibold">Posição para salvar</div><div>{posicaoEdicao.lat.toFixed(7)}, {posicaoEdicao.lng.toFixed(7)}</div><div className="text-xs text-muted-foreground">Precisão: {posicaoEdicao.precisao == null ? "não informada" : `${Math.round(posicaoEdicao.precisao)} m`}</div></> : "Esta árvore ainda não tem posição. Fique junto dela e capture o GPS."}
            </div>
            {!encerrado && <>
              <Button variant="outline" className="w-full" disabled={capturando || busy} onClick={capturarPosicao}><Crosshair /> {capturando ? "Capturando GPS…" : posicaoEdicao ? "Atualizar com minha posição" : "Capturar minha posição"}</Button>
              <Button className="w-full" disabled={!posicaoEdicao || busy} onClick={() => registrarArvore(null)}><MapPin /> {busy ? "Salvando…" : "Salvar localização"}</Button>
              {editando.abatida_em ? <Button variant="outline" className="w-full" disabled={!posicaoEdicao || busy} onClick={() => registrarArvore(false)}>Desfazer abatimento</Button> : <Button variant="destructive" className="w-full" disabled={!posicaoEdicao || busy} onClick={() => registrarArvore(true)}><TreePine /> Registrar árvore abatida aqui</Button>}
            </>}
            {encerrado && <p className="text-sm text-muted-foreground">Manejo encerrado: o mapa e os registros ficam disponíveis para consulta.</p>}
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

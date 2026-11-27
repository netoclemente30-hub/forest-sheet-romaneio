import { useAuth } from "@/hooks/useAuth";
import { ClienteRomaneio, clienteRomaneioVazio } from "@/components/ClienteRomaneio";
import { pode } from "@/lib/funcoes";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { romaneiosQuery, torasQuery, type Tora } from "@/lib/data";
import { fmtM3 } from "@/lib/volume";
import { resumoPorEspecie } from "@/lib/romaneio";
import { getEmpresaAtiva } from "@/lib/empresa";
import { empresaDaOperacao, listarCadastrosRomaneio } from "@/lib/cadastros-empresa";
import { estoqueComFila } from "@/lib/tora-origem";
import { useFilaOffline } from "@/hooks/useFilaOffline";
import { fila, type Op } from "@/lib/offline/fila";
import { sincronizar } from "@/lib/offline/sync";
import { capturarLog } from "@/lib/registro";
import { resolverQrSerragem } from "@/lib/qr-serragem";
import { BipagemCarga } from "@/components/BipagemCarga";
import { ResumoCargaConsolidada } from "@/components/ResumoCargaConsolidada";
import { consolidarCarga } from "@/lib/carga-consolidada";
import { QrScanner } from "@/components/QrScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, X, AlertTriangle } from "lucide-react";
import { clienteDoRomaneio } from "@/lib/fiscal-cargas";
import { projetarDados } from "@/lib/offline/projecao";

export const Route = createFileRoute("/romaneio")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>) => ({
    editar: typeof search["editar"] === "string" ? search["editar"] : "",
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Novo romaneio — Manejo Florestal" },
      { name: "description", content: "Monte a carga do caminhão pelas plaquetas e some os volumes." },
      { property: "og:title", content: "Novo romaneio — Manejo Florestal" },
      { property: "og:description", content: "Monte a carga do caminhão pelas plaquetas e some os volumes." },
    ],
  }),
  component: RomaneioPage,
});

function RomaneioPage() {
  const { papel, empresaId, isSuperAdmin, session } = useAuth();
  const empresa = empresaDaOperacao(isSuperAdmin, empresaId, getEmpresaAtiva());
  const podeCarregar = pode(papel, "carga_criar");
  const { editar } = Route.useSearch();
  const toras = useQuery(torasQuery);
  const roms = useQuery(romaneiosQuery);
  const qc = useQueryClient();
  const nav = useNavigate();
  const cabVazio = () => ({ placa: "", julieta: "", motorista: "", cpf: "", data: new Date().toISOString().slice(0, 10) });
  const [cab, setCab] = useState(cabVazio);
  const [cliente, setCliente] = useState(clienteRomaneioVazio);
  const [itens, setItens] = useState<Tora[]>([]);
  const itensAtuais = useRef<Tora[]>([]);
  const edicaoCarregada = useRef("");
  function atualizarItens(novos: Tora[]) {
    itensAtuais.current = novos;
    setItens(novos);
  }
  const [plq, setPlq] = useState("");
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendentes = useFilaOffline();

  const cad = useQuery({
    queryKey: ["cadastros-romaneio", empresa],
    queryFn: () => empresa ? listarCadastrosRomaneio(empresa) : Promise.resolve({ motoristas: [], veiculos: [], clientes: [] }),
    networkMode: "always",
    enabled: !!empresa,
  });
  const setMotorista = (nome: string) => {
    const m = cad.data?.motoristas.find((x) => x.nome.toLowerCase() === nome.trim().toLowerCase());
    setCab((c) => ({ ...c, motorista: nome, cpf: m?.cpf ?? "" }));
  };

  const estoque = useMemo(() => estoqueComFila(toras.data ?? [], pendentes.itens, empresa), [toras.data, pendentes.itens, empresa]);
  const mapa = useMemo(() => new Map(estoque.filter((t) => empresa && t.empresa_id === empresa).map((t) => [t.plaqueta, t])), [estoque, empresa]);
  const registros = useMemo(() => projetarDados("romaneios", roms.data ?? [], pendentes.itens, empresa), [roms.data, pendentes.itens, empresa]);
  const registroEdicao = editar ? registros.find((r) => r.id === editar && r.empresa_id === empresa) : undefined;
  const carregandoEdicao = !!editar && (roms.isLoading || toras.isLoading || pendentes.carregando);
  const chaveEdicao = `${empresa ?? ""}:${editar ?? ""}`;

  useEffect(() => {
    if (edicaoCarregada.current === chaveEdicao || carregandoEdicao) return;
    edicaoCarregada.current = chaveEdicao;
    setScan(false);
    setPlq("");
    if (!editar || !registroEdicao) {
      setCab(cabVazio());
      setCliente(clienteRomaneioVazio);
      atualizarItens([]);
      return;
    }
    setCab({
      placa: registroEdicao.placa ?? "", julieta: registroEdicao.julieta ?? "",
      motorista: registroEdicao.motorista ?? "", cpf: registroEdicao.cpf ?? "", data: registroEdicao.data,
    });
    const salvo = clienteDoRomaneio(registroEdicao.cliente);
    setCliente({ ...clienteRomaneioVazio, ...salvo, ...salvo?.endereco });
    atualizarItens(estoque.filter((t) => t.empresa_id === empresa && t.romaneio_id === editar));
    // O formulário é inicializado uma vez por empresa/romaneio; atualizações não apagam digitação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveEdicao, carregandoEdicao, editar, registroEdicao, empresa]);

  function bipar(raw: string): string | null {
    if (!podeCarregar || !empresa) return "Selecione uma empresa com permissão de carregamento.";
    let tora: Tora;
    try {
      tora = resolverQrSerragem(raw, estoque, empresa);
    } catch (erro) {
      return erro instanceof Error ? erro.message : "Não foi possível ler esta etiqueta.";
    }
    const atual = mapa.get(tora.plaqueta);
    const pertenceAEstaCarga = !!editar && atual?.romaneio_id === editar;
    if (!atual || ((atual.carregada || atual.romaneio_id) && !pertenceAEstaCarga)) return `Plaqueta ${tora.plaqueta} indisponível para esta carga.`;
    if (atual.serrada_em) return `Plaqueta ${tora.plaqueta} já foi serrada.`;
    if (itensAtuais.current.some(t => t.plaqueta === tora.plaqueta)) return `Plaqueta ${tora.plaqueta} já está nesta carga.`;
    atualizarItens([atual, ...itensAtuais.current]);
    return null;
  }

  function adicionar(raw: string) {
    const aviso = bipar(raw);
    if (aviso) toast.warning(aviso);
    else toast.success("Tora adicionada à carga.");
  }

  const consolidado = consolidarCarga(itens.map(t => ({
    especie: t.especie || "Não informada", produto: "Tora", autorizacao: t.autex || "Não informada",
    pecas: 1, volume: Number(t.volume),
  })));
  const total = itens.reduce((n, t) => n + Number(t.volume), 0);
  const resumo = resumoPorEspecie(itens);

  async function salvar() {
    if (!podeCarregar) return;
    if (!empresa) { toast.error("Selecione uma empresa antes de criar o romaneio"); return; }
    if (itens.some((t) => t.empresa_id !== empresa)) {
      toast.error("Há toras de outra empresa nesta carga. Refaça a seleção.");
      return;
    }
    if (!cab.placa.trim()) { toast.error("Preencha a placa do caminhão"); return; }
    if (!itens.length) { toast.error("Adicione plaquetas"); return; }
    if (busy) return;
    setBusy(true);
    try {
      const cabCompleto = { ...cab, cliente: cliente.nome.trim() || cliente.documento.trim() ? cliente : null };
      const dados = {
        cab: cabCompleto, total_volume: Math.round(total * 10000) / 10000,
        qtd_toras: itens.length, plaquetas: itens.map((t) => t.plaqueta), empresa_id: empresa,
      };
      const salvarNaFila = async () => {
        if (editar) {
          const relacionados = pendentes.itens.filter((i) =>
            (i.op.tipo === "romaneio_salvar" && (i.op.log?.operacao_id ?? i.id) === editar) ||
            (i.op.tipo === "romaneio_editar" && i.op.id === editar),
          );
          const anterior = relacionados[relacionados.length - 1];
          if (anterior?.envio_iniciado) throw new Error("O envio deste romaneio já começou. Aguarde a confirmação antes de editar.");
          if (anterior?.op.tipo === "romaneio_salvar") {
            await fila().substituir(anterior.id, { ...anterior.op, ...dados });
            return;
          }
          if (anterior?.op.tipo === "romaneio_editar") {
            await fila().substituir(anterior.id, { ...anterior.op, ...dados });
            return;
          }
          const log = await capturarLog("Romaneio editado", `${itens.length} toras · ${fmtM3(total)} m³ · placa ${cab.placa}`);
          const op: Op = { tipo: "romaneio_editar", id: editar, ...dados, log };
          await fila().enfileirar(op);
          return;
        }
        const log = await capturarLog("Romaneio salvo", `${itens.length} toras · ${fmtM3(total)} m³ · placa ${cab.placa}`);
        await fila().enfileirar({ tipo: "romaneio_salvar", ...dados, log });
      };
      if (navigator.locks) await navigator.locks.request("gestor-fila-sync", salvarNaFila);
      else await salvarNaFila();
      void sincronizar(fila()).catch(() => { /* A carga permanece na fila para nova tentativa. */ });
      atualizarItens([]);
      toast.success(editar ? "Alterações guardadas neste aparelho — aguarda confirmação na nuvem" : "Romaneio guardado neste aparelho — aguarda confirmação na nuvem");
      await qc.invalidateQueries();
      if (editar) nav({ to: "/historico/$id", params: { id: editar } });
      else nav({ to: "/historico" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o romaneio");
    } finally {
      setBusy(false);
    }
  }

  const f = (k: keyof typeof cab, label: string, type = "text", list?: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} list={list} aria-label={label.trim()} value={cab[k]} onChange={(e) => (k === "motorista" ? setMotorista(e.target.value) : setCab({ ...cab, [k]: e.target.value }))} className="h-11" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-3xl font-bold uppercase">{editar ? "Editar romaneio" : "Romaneio de carga"}</h1>
        {editar ? <Link to="/historico/$id" params={{ id: editar }} className="text-sm font-semibold text-primary underline">Cancelar edição</Link> : <Link to="/historico" className="text-sm font-semibold text-primary underline">Ver romaneios emitidos</Link>}
      </div>
      {!empresa && <p role="alert" className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">Selecione uma empresa no topo para consultar cadastros e lançar romaneios.</p>}
      {editar && !carregandoEdicao && !registroEdicao && <p role="alert" className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">Romaneio não encontrado nesta empresa ou na cópia deste aparelho.</p>}
      {registroEdicao?.recebido_em && <p role="alert" className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">Esta carga já foi recebida no pátio e não pode mais ser editada.</p>}
      {cad.isError && <p role="alert" className="rounded-md border px-3 py-2 text-sm text-destructive">Não foi possível carregar clientes, motoristas e veículos desta empresa. Confira a conexão.</p>}
      <datalist id="lista-caminhao">{cad.data?.veiculos.filter((v) => v.tipo === "caminhao").map((v) => <option key={v.placa} value={v.placa} />)}</datalist>
      <datalist id="lista-reboque">{cad.data?.veiculos.filter((v) => v.tipo === "reboque").map((v) => <option key={v.placa} value={v.placa} />)}</datalist>
      <datalist id="lista-motorista">{cad.data?.motoristas.map((m) => <option key={m.nome} value={m.nome} />)}</datalist>
      <div className="bg-card border rounded-xl p-3 grid grid-cols-2 gap-2">
        {f("placa", "Placa / caminhão", "text", "lista-caminhao")}
        {f("julieta", " Reboque", "text", "lista-reboque")}
        {f("motorista", "Motorista", "text", "lista-motorista")}
        {f("cpf", "CPF")}
        <div className="col-span-2">{f("data", "Data", "date")}</div>
      </div>
      {empresa && session?.user.id && <ClienteRomaneio key={`${empresa}:${editar ?? "novo"}`} empresa={empresa} usuario={session.user.id} salvos={cad.data?.clientes ?? []} cliente={cliente} alterar={setCliente} />}
      <ResumoCargaConsolidada linhas={consolidado} />
      <details className="bg-card border rounded-xl p-3">
        <summary className="font-semibold cursor-pointer">Cadastros salvos (toque para preencher)</summary>
        <div className="mt-2 space-y-2 text-sm">
          {([["Caminhões", "caminhao", "placa"], ["Reboques", "reboque", "julieta"]] as const).map(([titulo, tipo, campo]) => (
            <div key={tipo}>
              <div className="text-xs text-muted-foreground">{titulo}</div>
              <div className="flex flex-wrap gap-1">
                {cad.data?.veiculos.filter((v) => v.tipo === tipo).map((v) => <Button key={v.placa} size="sm" variant="outline" onClick={() => setCab((c) => ({ ...c, [campo]: v.placa }))}>{v.placa}</Button>)}
                {!cad.data?.veiculos.some((v) => v.tipo === tipo) && <span className="text-muted-foreground">Nenhum ainda</span>}
              </div>
            </div>
          ))}
          <div>
            <div className="text-xs text-muted-foreground">Motoristas</div>
            <div className="flex flex-wrap gap-1">
              {cad.data?.motoristas.map((m) => <Button key={m.nome} size="sm" variant="outline" onClick={() => setCab((c) => ({ ...c, motorista: m.nome, cpf: m.cpf ?? "" }))}>{m.nome}</Button>)}
              {!cad.data?.motoristas.length && <span className="text-muted-foreground">Nenhum ainda</span>}
            </div>
          </div>
        </div>
      </details>

      <div className="sticky top-14 z-10 bg-background py-2 space-y-2">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); adicionar(plq); setPlq(""); inputRef.current?.focus(); }}>
          <Input ref={inputRef} aria-label="Plaqueta ou conteúdo QR" placeholder="Digite a plaqueta ou cole o QR" value={plq} onChange={(e) => setPlq(e.target.value)} className="h-12 text-lg" />
          <Button type="submit" className="h-12">Adicionar</Button>
          <Button type="button" variant="secondary" className="h-12" aria-label="Ler QR code" onClick={() => setScan(!scan)}><Camera /></Button>
        </form>
        {!scan && empresa && podeCarregar && <BipagemCarga key={empresa} onScan={bipar} />}
        {scan && <QrScanner onScan={adicionar} onClose={() => { setScan(false); toast.error("Não foi possível abrir a câmera"); }} />}
        <div className="rounded-lg bg-forest text-primary-foreground px-4 py-3 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm opacity-80">{itens.length} toras · volume físico</span>
            <span className="font-display text-3xl font-bold">{fmtM3(total)} m³</span>
          </div>
        </div>
      </div>

      {resumo.length > 0 && <div className="bg-card border rounded-xl p-3">
        <h2 className="text-lg font-bold uppercase mb-1">Por espécie</h2>
        {resumo.map((r) => <div key={r.especie} className="flex justify-between text-sm py-0.5">
          <span>{r.especie}{r.nome_cientifico && <i className="text-muted-foreground"> · {r.nome_cientifico}</i>} <span className="text-muted-foreground">({r.qtd})</span></span>
          <span className="font-medium">{fmtM3(r.volume)}</span>
        </div>)}
      </div>}

      <div className="bg-card border rounded-xl divide-y">
        {itens.map((t) => <div key={t.plaqueta} className="flex items-center gap-3 p-3">
          <div className="font-display text-xl font-bold w-14">{t.plaqueta}</div>
          <div className="flex-1 min-w-0">
            <div className="truncate">{t.especie}</div>
            <div className="text-xs text-muted-foreground">Árv. {t.arvore} · Sec. {t.secao ?? "–"}</div>
            <div className="text-xs">Topo {t.d_topo1 ?? "–"}×{t.d_topo2 ?? "–"} · Pé {t.d_pe1 ?? "–"}×{t.d_pe2 ?? "–"} cm · {t.comprimento ?? "–"} m</div>
          </div>
          <div className="text-right text-sm font-semibold">{fmtM3(Number(t.volume))}<div className="text-xs font-normal text-muted-foreground">físico</div></div>
          <Button size="icon" variant="ghost" aria-label={`Remover plaqueta ${t.plaqueta}`} onClick={() => atualizarItens(itensAtuais.current.filter((x) => x.plaqueta !== t.plaqueta))}><X /></Button>
        </div>)}
        {!itens.length && <div className="p-4 text-sm text-muted-foreground flex gap-2"><AlertTriangle className="size-4 shrink-0" />Plaquetas já carregadas são bloqueadas automaticamente.</div>}
      </div>
      {podeCarregar && <Button size="lg" className="w-full h-12" disabled={busy || !empresa || !itens.length || !!registroEdicao?.recebido_em || !!editar && !registroEdicao} onClick={salvar}>{busy ? "Guardando…" : editar ? "Salvar alterações" : "Salvar romaneio"}</Button>}
    </div>
  );
}

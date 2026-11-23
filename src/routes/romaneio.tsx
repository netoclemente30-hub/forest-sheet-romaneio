import { useAuth } from "@/hooks/useAuth";
import { pode } from "@/lib/funcoes";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { torasQuery, type Tora } from "@/lib/data";
import { Link } from "@tanstack/react-router";
import { fmtM3, fmtM3Sinal } from "@/lib/volume";
import { TextoMedidaComercial } from "@/components/MedidaComercial";
import { totaisComerciais } from "@/lib/medida-comercial";
import { resumoPorEspecie } from "@/lib/romaneio";
import { getEmpresaAtiva } from "@/lib/empresa";
import { empresaDaOperacao, listarCadastrosRomaneio } from "@/lib/cadastros-empresa";
import { estoqueComFila } from "@/lib/tora-origem";
import { useFilaOffline } from "@/hooks/useFilaOffline";
import { fila } from "@/lib/offline/fila";
import { sincronizar } from "@/lib/offline/sync";
import { capturarLog } from "@/lib/registro";
import { plaquetaDoQr } from "@/lib/tora-qr";
import { QrScanner } from "@/components/QrScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, X, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/romaneio")({
  staticData: { sitemap: false },
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
  const { papel, empresaId, isSuperAdmin } = useAuth();
  const empresa = empresaDaOperacao(isSuperAdmin, empresaId, getEmpresaAtiva());
  const podeCarregar = pode(papel, "carga_criar");
  const toras = useQuery(torasQuery);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [cab, setCab] = useState({ placa: "", julieta: "", motorista: "", cpf: "", data: new Date().toISOString().slice(0, 10) });
  const clienteVazio = { nome: "", documento: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "", cep: "" };
  const [cliente, setCliente] = useState<typeof clienteVazio>(clienteVazio);
  const [itens, setItens] = useState<Tora[]>([]);
  const [plq, setPlq] = useState("");
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const pendentes = useFilaOffline();
  const estoque = useMemo(() => estoqueComFila(toras.data ?? [], pendentes.itens, empresa), [toras.data, pendentes.itens, empresa]);
  const mapa = useMemo(() => new Map(estoque.filter((t) => empresa && t.empresa_id === empresa).map((t) => [t.plaqueta, t])), [estoque, empresa]);

  const adicionar = useCallback(
    (raw: string) => {
      const n = plaquetaDoQr(raw);
      if (!n) { toast.error("QR code inválido ou plaqueta inválida"); return; }
      const t = mapa.get(n);
      if (!t) { toast.error(`Plaqueta ${n} não encontrada no inventário`); return; }
      if (t.carregada) { toast.warning(`Plaqueta ${n} JÁ FOI CARREGADA em outra carga!`, { duration: 6000 }); return; }
      setItens((cur) => {
        if (cur.some((x) => x.plaqueta === n)) {
          toast.warning(`Plaqueta ${n} já está nesta carga`);
          return cur;
        }
        toast.success(`${n} · ${t.especie} · ${fmtM3(Number(t.volume))} m³`);
        return [t, ...cur];
      });
    },
    [mapa],
  );

  const total = itens.reduce((n, t) => n + Number(t.volume), 0);
  const totais = totaisComerciais(itens);
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
      const log = await capturarLog("Romaneio salvo", `${itens.length} toras · ${fmtM3(total)} m³ · placa ${cab.placa || "–"}`);
      await fila().enfileirar({
        tipo: "romaneio_salvar",
        cab: { ...cab, cliente: cliente.nome.trim() || cliente.documento.trim() ? cliente : null },
        total_volume: Math.round(total * 10000) / 10000,
        qtd_toras: itens.length,
        plaquetas: itens.map((t) => t.plaqueta),
        empresa_id: empresa,
        log,
      });
      setItens([]);
      toast.success("Romaneio guardado neste aparelho — aguarda confirmação na nuvem");
      nav({ to: "/historico" });
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
        <h1 className="text-3xl font-bold uppercase">Romaneio de carga</h1>
        <Link to="/historico" className="text-sm font-semibold text-primary underline">Ver romaneios emitidos</Link>
      </div>
      {!empresa && <p role="alert" className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">
        Selecione uma empresa no topo para consultar cadastros e lançar romaneios.
      </p>}
      {cad.isError && <p role="alert" className="rounded-md border px-3 py-2 text-sm text-destructive">
        Não foi possível carregar motoristas e veículos desta empresa. Confira a conexão.
      </p>}
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
      <datalist id="lista-cliente">{cad.data?.clientes.map((c) => <option key={c.nome} value={c.nome} />)}</datalist>
      <div className="bg-card border rounded-xl p-3 space-y-2">
        <p className="font-semibold text-sm">Cliente / destinatário (vai para a nota fiscal)</p>
        {!!cad.data?.clientes.length && <div className="flex flex-wrap gap-1">
          {cad.data.clientes.slice(0, 8).map((c) => <Button key={c.nome} size="sm" variant="outline" onClick={() => setCliente({ ...clienteVazio, ...c })}>{c.nome}</Button>)}
        </div>}
        <div className="grid grid-cols-2 gap-2">
          {([["nome", "Nome / razão social", 2], ["documento", "CPF / CNPJ", 2], ["logradouro", "Endereço (rua)", 2], ["numero", "Número", 1], ["complemento", "Complemento", 1], ["bairro", "Bairro", 1], ["municipio", "Município", 1], ["uf", "UF", 1], ["cep", "CEP", 1]] as const).map(([k, label, span]) => (
            <div key={k} className={span === 2 ? "col-span-2 space-y-1" : "space-y-1"}>
              <Label className="text-xs">{label}</Label>
              <Input aria-label={label} list={k === "nome" ? "lista-cliente" : undefined} value={cliente[k]} maxLength={k === "uf" ? 2 : undefined} className="h-11"
                onChange={(e) => {
                  const v = e.target.value;
                  const salvo = k === "nome" ? cad.data?.clientes.find((c) => c.nome.toLowerCase() === v.trim().toLowerCase()) : undefined;
                  setCliente(salvo ? { ...clienteVazio, ...salvo } : { ...cliente, [k]: k === "uf" ? v.toUpperCase() : v });
                }} />
            </div>
          ))}
        </div>
      </div>
      <details className="bg-card border rounded-xl p-3">
        <summary className="font-semibold cursor-pointer">Cadastros salvos (toque para preencher)</summary>
        <div className="mt-2 space-y-2 text-sm">
          {([["Caminhões", "caminhao", "placa"], ["Reboques", "reboque", "julieta"]] as const).map(([titulo, tipo, campo]) => (
            <div key={tipo}>
              <div className="text-xs text-muted-foreground">{titulo}</div>
              <div className="flex flex-wrap gap-1">
                {cad.data?.veiculos.filter((v) => v.tipo === tipo).map((v) => (
                  <Button key={v.placa} size="sm" variant="outline" onClick={() => setCab((c) => ({ ...c, [campo]: v.placa }))}>{v.placa}</Button>
                ))}
                {!cad.data?.veiculos.some((v) => v.tipo === tipo) && <span className="text-muted-foreground">Nenhum ainda</span>}
              </div>
            </div>
          ))}
          <div>
            <div className="text-xs text-muted-foreground">Motoristas</div>
            <div className="flex flex-wrap gap-1">
              {cad.data?.motoristas.map((m) => (
                <Button key={m.nome} size="sm" variant="outline" onClick={() => setCab((c) => ({ ...c, motorista: m.nome, cpf: m.cpf ?? "" }))}>{m.nome}</Button>
              ))}
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
        {scan && <QrScanner onScan={adicionar} onClose={() => { setScan(false); toast.error("Não foi possível abrir a câmera"); }} />}
        <div className="rounded-lg bg-forest text-primary-foreground px-4 py-3 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm opacity-80">{itens.length} toras · volume físico</span>
            <span className="font-display text-3xl font-bold">{fmtM3(total)} m³</span>
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <span>Comercial: <b>{fmtM3(totais.comercial)} m³</b></span>
            <span>Diferença: <b>{fmtM3Sinal(totais.diferenca)} m³</b></span>
          </div>
        </div>
      </div>

      {resumo.length > 0 && (
        <div className="bg-card border rounded-xl p-3">
          <h2 className="text-lg font-bold uppercase mb-1">Por espécie</h2>
          {resumo.map((r) => (
            <div key={r.especie} className="flex justify-between text-sm py-0.5">
              <span>{r.especie}{r.nome_cientifico && <i className="text-muted-foreground"> · {r.nome_cientifico}</i>} <span className="text-muted-foreground">({r.qtd})</span></span>
              <span className="font-medium">{fmtM3(r.volume)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card border rounded-xl divide-y">
        {itens.map((t) => (
          <div key={t.plaqueta} className="flex items-center gap-3 p-3">
            <div className="font-display text-xl font-bold w-14">{t.plaqueta}</div>
            <div className="flex-1 min-w-0">
              <div className="truncate">{t.especie}</div>
              <div className="text-xs text-muted-foreground">Árv. {t.arvore} · Sec. {t.secao ?? "–"}</div>
              <div className="text-xs">Topo {t.d_topo1 ?? "–"}×{t.d_topo2 ?? "–"} · Pé {t.d_pe1 ?? "–"}×{t.d_pe2 ?? "–"} cm · {t.comprimento ?? "–"} m</div>
              <TextoMedidaComercial tora={t} />
            </div>
            <div className="text-right text-sm font-semibold">{fmtM3(Number(t.volume))}<div className="text-xs font-normal text-muted-foreground">físico</div></div>
            <Button size="icon" variant="ghost" aria-label="Remover" onClick={() => setItens(itens.filter((x) => x.plaqueta !== t.plaqueta))}><X /></Button>
          </div>
        ))}
        {!itens.length && (
          <div className="p-4 text-sm text-muted-foreground flex gap-2"><AlertTriangle className="size-4 shrink-0" />Plaquetas já carregadas são bloqueadas automaticamente.</div>
        )}
      </div>
      {podeCarregar && <Button size="lg" className="w-full h-12" disabled={busy || !empresa || !itens.length} onClick={salvar}>Salvar romaneio</Button>}
    </div>
  );
}

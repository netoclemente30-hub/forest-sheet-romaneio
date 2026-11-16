import { useAuth } from "@/hooks/useAuth";
import { pode } from "@/lib/funcoes";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Romaneio, Tora } from "@/lib/data";
import { lerQrRomaneio } from "@/lib/tora-qr";
import { fila } from "@/lib/offline/fila";
import { estaOnline } from "@/lib/offline/sync";
import { lerCache } from "@/lib/offline/cache";
import { useFilaOffline } from "@/hooks/useFilaOffline";
import { getEmpresaAtiva } from "@/lib/empresa";
import { empresaDaOperacao, listarPatiosSerraria } from "@/lib/cadastros-empresa";
import { conferirCargaQr, recebimentoPendente } from "@/lib/tora-origem";
import { capturarLog } from "@/lib/registro";
import { registrarOperacao } from "@/lib/registro-operacao";
import { fmtM3 } from "@/lib/volume";
import { resumoPorEspecie } from "@/lib/romaneio";
import { QrScanner } from "@/components/QrScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/entrada")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Entrada no pátio — Serraria · Gestor Florestal" },
      { name: "description", content: "Leia o QR do romaneio e receba todas as toras da carga de uma vez." },
      { property: "og:title", content: "Entrada no pátio — Serraria · Gestor Florestal" },
      { property: "og:description", content: "Leia o QR do romaneio e receba todas as toras da carga de uma vez." },
    ],
  }),
  component: Entrada,
});

function Entrada() {
  const { papel, empresaId, isSuperAdmin } = useAuth();
  const podeReceber = pode(papel, "serraria_operar");
  const qc = useQueryClient();
  const [id, setId] = useState<string | null>(null);
  const [qrPlaquetas, setQrPlaquetas] = useState<number[]>([]);
  const [txt, setTxt] = useState("");
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [patio, setPatio] = useState("");
  const pendentes = useFilaOffline();
  const empresaEsperada = empresaDaOperacao(isSuperAdmin, empresaId, getEmpresaAtiva());
  const patios = useQuery({
    queryKey: ["patios", empresaEsperada],
    enabled: !!empresaEsperada,
    networkMode: "always",
    queryFn: () => listarPatiosSerraria(empresaEsperada!),
  });

  const q = useQuery({
    queryKey: ["entrada", id, empresaEsperada],
    enabled: !!id && !!empresaEsperada,
    networkMode: "always",
    queryFn: async () => {
      if (!estaOnline()) {
        // Offline: only loads already cached for this account/company.
        const [roms, toras] = await Promise.all([lerCache<Romaneio>("romaneios"), lerCache<Tora>("toras")]);
        const r = roms?.find((x) => x.id === id && x.empresa_id === empresaEsperada) ?? null;
        return { r, itens: r ? (toras ?? []).filter((t) => t.romaneio_id === id && t.empresa_id === r.empresa_id).sort((a, b) => a.plaqueta - b.plaqueta) : [], offline: true };
      }
      const [{ data: r, error }, { data: itens, error: e2 }] = await Promise.all([
        supabase.from("romaneios").select("*").eq("id", id!).eq("empresa_id", empresaEsperada!).maybeSingle(),
        supabase.from("toras").select("*").eq("romaneio_id", id!).eq("empresa_id", empresaEsperada!).order("plaqueta"),
      ]);
      if (error) throw error;
      if (e2) throw e2;
      return { r: r as Romaneio | null, itens: ((itens ?? []) as Tora[]).filter((t) => r && t.empresa_id === r.empresa_id), offline: false };
    },
  });

  function ler(raw: string) {
    if (!empresaEsperada) { toast.error("Selecione uma empresa antes de ler a carga"); return; }
    const d = lerQrRomaneio(raw);
    if (!d) { toast.error("Este não é um QR de romaneio"); return; }
    setScan(false);
    setQrPlaquetas(d.plaquetas);
    setId(d.id);
  }

  const pendente = id ? recebimentoPendente(pendentes.itens, id, q.data?.r?.empresa_id ?? null) : null;
  const conferencia = q.data?.r ? conferirCargaQr(qrPlaquetas, q.data.r, q.data.itens, empresaEsperada) : null;

  async function confirmar() {
    if (!podeReceber || busy || !empresaEsperada) return;
    if (!id || !q.data?.r?.empresa_id) return;
    if (conferencia && !conferencia.ok) { toast.error(conferencia.motivo); return; }
    const empresa = q.data.r.empresa_id;
    if (empresa !== empresaEsperada) { toast.error("A carga pertence a outra empresa"); return; }
    const p = patio.trim();
    if (!p) { toast.error("Escolha o pátio de destino"); return; }
    setBusy(true);
    try {
      // Never queue a second receipt for the same load on this device.
      const ja = recebimentoPendente(await fila().listar(), id, empresa);
      if (ja) { toast.error(ja.erro ? "Esta entrada já está na fila com erro — corrija-a em Pendentes" : "Esta entrada já foi registrada e aguarda envio"); return; }
      const log = await capturarLog("Entrada no pátio", `Romaneio ${q.data.r.placa ?? id} · ${q.data.itens.length} toras · pátio ${p}`);
      if (!estaOnline()) {
        await fila().enfileirar({ tipo: "romaneio_recebido", id, patio: p, empresa_id: empresa, log });
        toast.success("Entrada salva offline — será enviada quando conectar");
        return;
      }
      await registrarOperacao("romaneio_recebido", empresa, { patio: p }, [id], log);
      await qc.invalidateQueries();
      toast.success(`Entrada de ${q.data.itens.length} toras confirmada no ${p}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível receber");
    } finally {
      setBusy(false);
    }
  }

  const r = q.data?.r;
  const itens = q.data?.itens ?? [];
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold uppercase">Entrada no pátio</h1>
      <p className="text-sm text-muted-foreground">Leia o QR do romaneio para receber todas as toras da carga de uma vez.</p>
      {!empresaEsperada && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">
        Selecione a empresa no topo antes de consultar cargas ou pátios.
      </p>}
      {patios.isError && <p role="alert" className="rounded-md border p-3 text-sm text-destructive">
        Não foi possível carregar os pátios desta empresa. Confira a conexão.
      </p>}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ler(txt); setTxt(""); }}>
        <Input aria-label="Conteúdo do QR do romaneio" placeholder="Cole o QR do romaneio" value={txt} disabled={!empresaEsperada} onChange={(e) => setTxt(e.target.value)} className="h-12" />
        <Button type="button" className="h-12" aria-label="Ler QR do romaneio" disabled={!empresaEsperada} onClick={() => setScan(!scan)}><Camera /> Ler QR</Button>
      </form>
      {scan && <QrScanner onScan={ler} onClose={() => { setScan(false); toast.error("Não foi possível abrir a câmera"); }} />}

      {id && q.isLoading && <p className="text-muted-foreground">Carregando carga…</p>}
      {id && q.data && !r && <p className="text-destructive">{q.data.offline ? "Sem internet e esta carga não está salva neste aparelho. Conecte para ler a carga." : "Romaneio não encontrado nesta empresa (pode ter sido excluído)."}</p>}
      {r && (
        <>
          <div className="bg-forest text-primary-foreground rounded-xl p-4">
            <div className="text-xs uppercase opacity-80">Romaneio · {new Date(r.data + "T12:00").toLocaleDateString("pt-BR")}</div>
            <div className="text-2xl font-bold uppercase">{r.placa || "Sem placa"} {r.julieta && `· Reboque ${r.julieta}`}</div>
            <div className="text-sm opacity-90">{r.motorista} {r.cpf && `· CPF ${r.cpf}`}</div>
            <div className="mt-2 font-display text-4xl font-bold">{itens.length} toras · {fmtM3(itens.reduce((n, t) => n + Number(t.volume), 0))} m³</div>
          </div>
          {conferencia && !conferencia.ok && <p role="alert" className="rounded-lg border border-destructive p-3 text-sm font-semibold text-destructive">{conferencia.motivo}</p>}
          {r.recebido_em ? (
            <div className="flex items-center gap-2 rounded-lg border p-3 text-success font-semibold"><CheckCircle2 /> Carga recebida em {new Date(r.recebido_em).toLocaleString("pt-BR")}{r.patio && ` · ${r.patio}`}</div>
          ) : pendente ? (
            <div role="status" className="rounded-lg border p-3 text-sm font-semibold">
              {pendente.erro ? `Entrada na fila com erro: ${pendente.erro}` : `Entrada registrada neste aparelho${pendente.em ? " em " + new Date(pendente.em).toLocaleString("pt-BR") : ""} · ${pendente.patio} · aguardando envio`}
            </div>
          ) : podeReceber ? (
            <>
            <label className="text-sm font-semibold block space-y-1">Pátio de destino
              <input list="lista-patios" aria-label="Pátio de destino" placeholder="Ex.: Pátio principal da serraria" value={patio} onChange={(e) => setPatio(e.target.value)} className="w-full h-12 rounded-md border bg-background px-3 font-normal" />
            </label>
            <datalist id="lista-patios">{(patios.data ?? []).map((x) => <option key={x.nome} value={x.nome} />)}</datalist>
            {!!patios.data?.length && <div className="flex flex-wrap gap-2">{patios.data.map((x) => <Button key={x.nome} type="button" size="sm" variant={patio === x.nome ? "default" : "outline"} onClick={() => setPatio(x.nome)}>{x.nome}</Button>)}</div>}
            <Button size="lg" className="w-full h-12" disabled={busy || !empresaEsperada || patios.isError || (conferencia ? !conferencia.ok : false)} onClick={confirmar}>Confirmar entrada das {itens.length} toras</Button>
            </>
          ) : <p className="text-sm text-muted-foreground">Carga aguardando recebimento.</p>}
          <div className="bg-card border rounded-xl p-3">
            {resumoPorEspecie(itens).map((e) => (
              <div key={e.especie} className="flex justify-between text-sm py-0.5"><span>{e.especie} ({e.qtd})</span><span className="font-medium">{fmtM3(e.volume)}</span></div>
            ))}
          </div>
          <div className="bg-card border rounded-xl divide-y">
            {itens.map((t) => (
              <div key={t.plaqueta} className="flex items-center gap-3 p-3 text-sm">
                <div className="font-display text-lg font-bold w-14">{t.plaqueta}</div>
                <div className="flex-1">{t.especie} <span className="text-muted-foreground">· Árv. {t.arvore}</span></div>
                <div className="font-semibold">{fmtM3(Number(t.volume))}</div>
              </div>
            ))}
          </div>
          <Link to="/serraria" search={{ aba: "patio" }} className="text-sm underline">Ver estoque do pátio na Serraria</Link>
        </>
      )}
    </div>
  );
}

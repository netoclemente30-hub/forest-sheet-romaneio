import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Romaneio, Tora } from "@/lib/data";
import { lerQrRomaneio } from "@/lib/tora-qr";
import { empresaIdGravacao } from "@/lib/empresa";
import { fila } from "@/lib/offline/fila";
import { estaOnline } from "@/lib/offline/sync";
import { capturarLog, gravarRegistro } from "@/lib/registro";
import { fmtM3 } from "@/lib/volume";
import { resumoPorEspecie } from "@/lib/romaneio";
import { QrScanner } from "@/components/QrScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/entrada")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Entrada no pátio — Manejo Florestal" },
      { name: "description", content: "Leia o QR do romaneio e receba todas as toras da carga de uma vez." },
      { property: "og:title", content: "Entrada no pátio — Manejo Florestal" },
      { property: "og:description", content: "Leia o QR do romaneio e receba todas as toras da carga de uma vez." },
    ],
  }),
  component: Entrada,
});

function Entrada() {
  const qc = useQueryClient();
  const [id, setId] = useState<string | null>(null);
  const [txt, setTxt] = useState("");
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [patio, setPatio] = useState("");
  const patios = useQuery({ queryKey: ["patios"], queryFn: async () => (await supabase.from("patios").select("*").order("nome")).data ?? [] });

  const q = useQuery({
    queryKey: ["entrada", id],
    enabled: !!id,
    queryFn: async () => {
      const [{ data: r, error }, { data: itens }] = await Promise.all([
        supabase.from("romaneios").select("*").eq("id", id!).maybeSingle(),
        supabase.from("toras").select("*").eq("romaneio_id", id!).order("plaqueta"),
      ]);
      if (error) throw error;
      return { r: r as Romaneio | null, itens: (itens ?? []) as Tora[] };
    },
  });

  function ler(raw: string) {
    const d = lerQrRomaneio(raw);
    if (!d) { toast.error("Este não é um QR de romaneio"); return; }
    setScan(false);
    setId(d.id);
  }

  async function confirmar() {
    if (!id) return;
    const p = patio.trim();
    if (!p) { toast.error("Escolha o pátio de destino"); return; }
    const log = await capturarLog("Entrada no pátio", `Romaneio ${r?.placa ?? id} · ${q.data?.itens.length ?? 0} toras · pátio ${p}`);
    if (!estaOnline()) {
      setBusy(true);
      await fila().enfileirar({ tipo: "romaneio_recebido", id, patio: p, empresa_id: empresaIdGravacao().empresa_id ?? null, log });
      setBusy(false);
      toast.success("Entrada salva offline — será enviada quando conectar");
      return;
    }
    setBusy(true);
    await supabase.from("patios").upsert({ nome: p, ...empresaIdGravacao() }, { onConflict: "empresa_id,nome", ignoreDuplicates: true });
    const { error } = await supabase.from("romaneios").update({ recebido_em: new Date().toISOString(), patio: p }).eq("id", id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await gravarRegistro(log);
    await qc.invalidateQueries();
    toast.success(`Entrada de ${q.data?.itens.length ?? 0} toras confirmada no ${p}`);
  }

  const r = q.data?.r;
  const itens = q.data?.itens ?? [];
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold uppercase">Entrada no pátio</h1>
      <p className="text-sm text-muted-foreground">Leia o QR do romaneio para receber todas as toras da carga de uma vez.</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ler(txt); setTxt(""); }}>
        <Input aria-label="Conteúdo do QR do romaneio" placeholder="Cole o QR do romaneio" value={txt} onChange={(e) => setTxt(e.target.value)} className="h-12" />
        <Button type="button" className="h-12" aria-label="Ler QR do romaneio" onClick={() => setScan(!scan)}><Camera /> Ler QR</Button>
      </form>
      {scan && <QrScanner onScan={ler} onClose={() => { setScan(false); toast.error("Não foi possível abrir a câmera"); }} />}

      {id && q.isLoading && <p className="text-muted-foreground">Carregando carga…</p>}
      {id && q.data && !r && <p className="text-destructive">Romaneio não encontrado (pode ter sido excluído).</p>}
      {r && (
        <>
          <div className="bg-forest text-primary-foreground rounded-xl p-4">
            <div className="text-xs uppercase opacity-80">Romaneio · {new Date(r.data + "T12:00").toLocaleDateString("pt-BR")}</div>
            <div className="text-2xl font-bold uppercase">{r.placa || "Sem placa"} {r.julieta && `· Reboque ${r.julieta}`}</div>
            <div className="text-sm opacity-90">{r.motorista} {r.cpf && `· CPF ${r.cpf}`}</div>
            <div className="mt-2 font-display text-4xl font-bold">{itens.length} toras · {fmtM3(itens.reduce((n, t) => n + Number(t.volume), 0))} m³</div>
          </div>
          {r.recebido_em ? (
            <div className="flex items-center gap-2 rounded-lg border p-3 text-success font-semibold"><CheckCircle2 /> Carga recebida em {new Date(r.recebido_em).toLocaleString("pt-BR")}{r.patio && ` · ${r.patio}`}</div>
          ) : (
            <>
            <label className="text-sm font-semibold block space-y-1">Pátio de destino
              <input list="lista-patios" aria-label="Pátio de destino" placeholder="Ex.: Pátio RJ Madeiras" value={patio} onChange={(e) => setPatio(e.target.value)} className="w-full h-12 rounded-md border bg-background px-3 font-normal" />
            </label>
            <datalist id="lista-patios">{(patios.data ?? []).map((x) => <option key={x.nome} value={x.nome} />)}</datalist>
            {!!patios.data?.length && <div className="flex flex-wrap gap-2">{patios.data.map((x) => <Button key={x.nome} type="button" size="sm" variant={patio === x.nome ? "default" : "outline"} onClick={() => setPatio(x.nome)}>{x.nome}</Button>)}</div>}
            <Button size="lg" className="w-full h-12" disabled={busy} onClick={confirmar}>Confirmar entrada das {itens.length} toras</Button>
            </>
          )}
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
          <Link to="/historico/$id" params={{ id: r.id }} className="text-sm underline">Ver romaneio completo</Link>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { zipSync } from "fflate";
import { supabase } from "@/integrations/supabase/client";
import { baixarNfeHomologacao } from "@/lib/spedy.functions";
import { salvarArquivo } from "@/lib/arquivo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Doc = { id: string; rascunho_id: string; status: string; numero: string | null; serie: string | null; chave_acesso: string | null; criado_em: string };
const mesAtual = () => new Date().toISOString().slice(0, 7);
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Aba do contador: cadastro do escritório e lote de XMLs autorizados por período. */
export function ContadorFiscal({ empresa }: { empresa: string }) {
  const baixar = useServerFn(baixarNfeHomologacao);
  const [f, setF] = useState({ escritorio: "", email: "", envio_automatico: true });
  const [inicio, setInicio] = useState(`${mesAtual()}-01`);
  const [fim, setFim] = useState(new Date().toISOString().slice(0, 10));
  const [docs, setDocs] = useState<Doc[]>([]);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void supabase.from("empresa_contador").select("escritorio,email,envio_automatico").eq("empresa_id", empresa).maybeSingle()
      .then(({ data }) => setF(data ?? { escritorio: "", email: "", envio_automatico: true }));
  }, [empresa]);
  useEffect(() => {
    void supabase.from("fiscal_documentos").select("id,rascunho_id,status,numero,serie,chave_acesso,criado_em").eq("empresa_id", empresa)
      .gte("criado_em", `${inicio}T00:00:00`).lte("criado_em", `${fim}T23:59:59`).order("criado_em")
      .then(({ data }) => setDocs((data ?? []) as Doc[]));
  }, [empresa, inicio, fim]);

  async function salvar() {
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) { toast.error("E-mail do contador inválido."); return; }
    const { error } = await supabase.from("empresa_contador").upsert({ empresa_id: empresa, escritorio: f.escritorio.trim(), email: f.email.trim().toLowerCase(), envio_automatico: f.envio_automatico, atualizado_em: new Date().toISOString() });
    if (error) toast.error("Não foi possível salvar o contador."); else toast.success("Contador salvo.");
  }
  const autorizadas = docs.filter((d) => d.status === "authorized");
  async function zip() {
    if (!autorizadas.length) { toast.error("Nenhuma nota autorizada no período."); return; }
    setOcupado(true);
    try {
      const arquivos: Record<string, Uint8Array> = {};
      for (const d of autorizadas) {
        const r = await baixar({ data: { empresa, rascunhoId: d.rascunho_id, tipo: "xml" } });
        if (r.ok) arquivos[`${d.chave_acesso ?? d.numero ?? d.id}.xml`] = b64(r.base64);
      }
      const n = Object.keys(arquivos).length;
      if (!n) { toast.error("A Spedy não devolveu nenhum XML."); return; }
      const blob = new Blob([zipSync(arquivos)], { type: "application/zip" });
      await salvarArquivo({ blob, nome: `xmls-${inicio}-a-${fim}.zip` });
      toast.success(`${n} XML(s) no arquivo.`);
    } finally { setOcupado(false); }
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="text-xl font-bold">Contador</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid text-sm">Escritório / responsável<Input value={f.escritorio} onChange={(e) => setF({ ...f, escritorio: e.target.value })} /></label>
        <label className="grid text-sm">E-mail do contador<Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.envio_automatico} onChange={(e) => setF({ ...f, envio_automatico: e.target.checked })} /> Enviar XML ao contador a cada nota autorizada</label>
      <Button onClick={salvar}>Salvar contador</Button>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid text-sm">De<Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
        <label className="grid text-sm">Até<Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></label>
      </div>
      <ul className="divide-y rounded-md border text-sm">
        {docs.length === 0 && <li className="p-2 text-muted-foreground">Nenhuma nota no período.</li>}
        {docs.map((d) => <li key={d.id} className="flex justify-between gap-2 p-2"><span>{d.criado_em.slice(0, 10).split("-").reverse().join("/")} · Nº {d.numero ?? "—"} · Série {d.serie ?? "—"}</span><span>{d.status === "authorized" ? "Autorizada" : d.status}</span></li>)}
      </ul>
      <Button variant="outline" disabled={ocupado} onClick={zip}>{ocupado ? "Gerando…" : `Baixar XMLs do período (.ZIP) · ${autorizadas.length}`}</Button>
    </section>
  );
}

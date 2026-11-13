import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getEmpresaAtiva } from "@/lib/empresa";
import { arvoresQuery, type Arvore } from "@/lib/data";
import { analisarCoordenadas, dadosCoordenadas } from "@/lib/import-coordenadas";
import { salvarCache } from "@/lib/offline/cache";
import { capturarLog, gravarRegistro } from "@/lib/registro";

export function ImportarCoordenadas({ autex, arvores }: { autex: string; arvores: Arvore[] }) {
  const { empresaId } = useAuth();
  const empresa = getEmpresaAtiva() ?? empresaId;
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<(ReturnType<typeof analisarCoordenadas> & { empresa: string; autex: string }) | null>(null);
  async function ler(file: File) {
    if (!empresa || !autex) { toast.error("Selecione um manejo e uma empresa."); return; }
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const nome = workbook.SheetNames[0];
      const sheet = nome ? workbook.Sheets[nome] : undefined;
      if (!sheet) throw new Error("Planilha vazia.");
      setPreview({ ...analisarCoordenadas(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }), arvores, empresa, autex), empresa, autex });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível ler a planilha."); }
    finally { setBusy(false); }
  }
  async function salvar() {
    if (!preview || preview.erros.length || busy) return;
    if (preview.empresa !== empresa || preview.autex !== autex) { setPreview(null); toast.error("O manejo mudou. Selecione a planilha novamente."); return; }
    if (!navigator.onLine) { toast.error("Conecte à internet para importar as coordenadas."); return; }
    setBusy(true);
    let salvas = 0;
    try {
      for (const item of preview.atualizacoes) {
        const agora = new Date().toISOString();
        const dados = dadosCoordenadas(item.latitude, item.longitude, agora);
        const log = await capturarLog("Coordenadas de árvore importadas", `Árvore ${item.arvore.numero} · AUTEX ${autex} · ${item.latitude}, ${item.longitude}`);
        const { data, error } = await supabase.from("arvores").update(dados).eq("id", item.arvore.id).eq("empresa_id", preview.empresa).eq("autex", preview.autex).select("id");
        if (error) throw new Error(error.message);
        if (!data?.length) throw new Error(`Árvore ${item.arvore.numero} não está mais disponível.`);
        await gravarRegistro(log);
        const todas = qc.getQueryData<Arvore[]>(arvoresQuery.queryKey) ?? arvores;
        const atualizadas = todas.map((a) => a.id === item.arvore.id ? { ...a, ...dados } : a);
        qc.setQueryData(arvoresQuery.queryKey, atualizadas);
        await salvarCache("arvores", atualizadas);
        salvas++;
      }
      toast.success(`${salvas} coordenadas importadas.`);
      setPreview(null);
    } catch (e) { toast.error(`${salvas} salvas. ${e instanceof Error ? e.message : "Falha ao importar."} Você pode tentar novamente.`); }
    finally { setBusy(false); await qc.invalidateQueries({ queryKey: arvoresQuery.queryKey }); }
  }
  return <>
    <input ref={input} type="file" className="hidden" accept=".xlsx,.xls,.xlsm,.csv" aria-label="Planilha de coordenadas" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void ler(file); }} />
    <Button variant="outline" disabled={busy || !autex || !empresa} onClick={() => input.current?.click()}><Upload />{busy ? "Processando…" : "Inserir planilha de coordenadas"}</Button>
    <Dialog open={!!preview} onOpenChange={(open) => { if (!open && !busy) setPreview(null); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar coordenadas</DialogTitle><DialogDescription>AUTEX {preview?.autex} · Somente as posições serão atualizadas. Medidas, espécie e abatimentos serão preservados.</DialogDescription></DialogHeader>
        <p className="text-sm">{preview?.atualizacoes.length ?? 0} árvores encontradas · {preview?.atualizacoes.filter((i) => i.arvore.latitude != null).length ?? 0} posições serão substituídas</p>
        {preview?.erros.length ? <div role="alert" className="space-y-1 text-sm text-destructive">{preview.erros.map((e, i) => <p key={i}>{e}</p>)}</div> : null}
        <div className="max-h-64 overflow-y-auto divide-y text-sm">{preview?.atualizacoes.map((i) => <div key={i.arvore.id} className="py-2"><strong>Árvore {i.arvore.numero} · {i.arvore.nome_vulgar}</strong><p className="text-muted-foreground">{i.latitude.toFixed(6)}, {i.longitude.toFixed(6)}</p></div>)}</div>
        <Button disabled={busy || !!preview?.erros.length || !preview?.atualizacoes.length} onClick={salvar}><Check />{busy ? "Salvando…" : "Confirmar coordenadas"}</Button>
      </DialogContent>
    </Dialog>
  </>;
}
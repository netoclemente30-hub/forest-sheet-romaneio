import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getEmpresaAtiva } from "@/lib/empresa";
import { arvoresQuery, type Arvore } from "@/lib/data";
import { analisarCoordenadas, dadosCoordenadas, precisaConversaoUtm, type SistemaCoordenadas } from "@/lib/import-coordenadas";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { salvarCache } from "@/lib/offline/cache";
import { capturarLog, gravarRegistro } from "@/lib/registro";
import { fila } from '@/lib/offline/fila';

export function ImportarCoordenadas({ autex, arvores }: { autex: string; arvores: Arvore[] }) {
  const { empresaId } = useAuth();
  const empresa = getEmpresaAtiva() ?? empresaId;
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [arquivo, setArquivo] = useState<{ rows: unknown[][]; arvores: Arvore[]; empresa: string; autex: string } | null>(null);
  const [tipo, setTipo] = useState<"decimal" | "utm">("decimal");
  const [fuso, setFuso] = useState("");
  const [hemisferio, setHemisferio] = useState<"sul" | "norte" | "">("");
  const [datum, setDatum] = useState<"SIRGAS2000" | "WGS84" | "SAD69" | "">("");
  const configurado = tipo === "decimal" || (!!fuso && !!hemisferio && !!datum);
  const preview = useMemo(() => {
    if (!arquivo) return null;
    const sistema: SistemaCoordenadas = tipo === "utm" && hemisferio && datum ? { tipo, fuso: Number(fuso), hemisferio, datum } : { tipo: "decimal" };
    return { ...analisarCoordenadas(arquivo.rows, arquivo.arvores, arquivo.empresa, arquivo.autex, sistema), empresa: arquivo.empresa, autex: arquivo.autex };
  }, [arquivo, tipo, fuso, hemisferio, datum]);
  async function ler(file: File) {
    if (!empresa || !autex) { toast.error("Selecione um manejo e uma empresa."); return; }
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const nome = workbook.SheetNames.find((n) => n.trim().toLowerCase() === "ficha de campo") ?? workbook.SheetNames[0];
      const sheet = nome ? workbook.Sheets[nome] : undefined;
      if (!sheet) throw new Error("Planilha vazia.");
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
      setTipo(precisaConversaoUtm(rows) ? "utm" : "decimal");
      setFuso(""); setHemisferio(""); setDatum("");
      setArquivo({ rows, arvores, empresa, autex });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível ler a planilha."); }
    finally { setBusy(false); }
  }
  async function salvar() {
    if (!preview || !configurado || preview.erros.length || busy) return;
    if (preview.empresa !== empresa || preview.autex !== autex) { setArquivo(null); toast.error("O manejo mudou. Selecione a planilha novamente."); return; }
    setBusy(true);
    let salvas = 0;
    try {
      for (const item of preview.atualizacoes) {
        const agora = new Date().toISOString();
        const dados = dadosCoordenadas(item.latitude, item.longitude, agora);
        const log = await capturarLog("Coordenadas de árvore importadas", `Árvore ${item.arvore.numero} · AUTEX ${autex} · ${item.latitude}, ${item.longitude}`);
        await fila().enfileirar({ tipo: 'arvore_gps', id: item.arvore.id, empresa_id: preview.empresa, autex: preview.autex, dados: { ...dados, abatida_em: item.arvore.abatida_em }, log });
        const todas = qc.getQueryData<Arvore[]>(arvoresQuery.queryKey) ?? arvores;
        const atualizadas = todas.map((a) => a.id === item.arvore.id ? { ...a, ...dados } : a);
        qc.setQueryData(arvoresQuery.queryKey, atualizadas);
        // The queue projects these coordinates; do not overwrite the authoritative cache.
        salvas++;
      }
      toast.success(`${salvas} coordenadas guardadas no aparelho — aguardam confirmação na nuvem.`);
      setArquivo(null);
    } catch (e) { toast.error(`${salvas} salvas. ${e instanceof Error ? e.message : "Falha ao importar."} Você pode tentar novamente.`); }
    finally { setBusy(false); await qc.invalidateQueries({ queryKey: arvoresQuery.queryKey }); }
  }
  return <>
    <input ref={input} type="file" className="hidden" accept=".xlsx,.xls,.xlsm,.csv" aria-label="Planilha de coordenadas" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void ler(file); }} />
    <Button variant="outline" className="h-auto min-h-11 max-w-full whitespace-normal text-left" disabled={busy || !autex || !empresa} onClick={() => input.current?.click()}><Upload />{busy ? "Processando…" : "Inserir planilha de coordenadas"}</Button>
    <Dialog open={!!preview} onOpenChange={(open) => { if (!open && !busy) setArquivo(null); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar coordenadas</DialogTitle><DialogDescription>AUTEX {preview?.autex} · Somente as posições serão atualizadas. Medidas, espécie e abatimentos serão preservados.</DialogDescription></DialogHeader>
        <Select value={tipo} disabled={busy} onValueChange={(v) => setTipo(v === "utm" ? "utm" : "decimal")}><SelectTrigger aria-label="Formato das coordenadas"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="decimal">Latitude / Longitude — graus decimais</SelectItem><SelectItem value="utm">UTM — metros (Este / Norte)</SelectItem></SelectContent></Select>
        {tipo === "utm" && <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Nesta planilha, Latitude contém Este (X) e Longitude contém Norte (Y), em metros. Confirme o fuso, hemisfério e datum com o engenheiro; não são informados no arquivo.</p>
          <label className="block space-y-1 text-sm"><span>Fuso UTM</span><Input aria-label="Fuso UTM" type="number" min={1} max={60} step={1} value={fuso} disabled={busy} onChange={(e) => setFuso(e.target.value)} /></label>
          <Select value={hemisferio} disabled={busy} onValueChange={(v) => { if (v === "sul" || v === "norte") setHemisferio(v); }}><SelectTrigger aria-label="Hemisfério"><SelectValue placeholder="Selecione o hemisfério" /></SelectTrigger><SelectContent><SelectItem value="sul">Sul</SelectItem><SelectItem value="norte">Norte</SelectItem></SelectContent></Select>
          <Select value={datum} disabled={busy} onValueChange={(v) => { if (v === "SIRGAS2000" || v === "WGS84" || v === "SAD69") setDatum(v); }}><SelectTrigger aria-label="Datum"><SelectValue placeholder="Selecione o datum" /></SelectTrigger><SelectContent><SelectItem value="SIRGAS2000">SIRGAS 2000</SelectItem><SelectItem value="WGS84">WGS84</SelectItem><SelectItem value="SAD69">SAD69</SelectItem></SelectContent></Select>
        </div>}
        {configurado && <>
          <p className="text-sm">{preview?.atualizacoes.length ?? 0} árvores encontradas · {preview?.atualizacoes.filter((i) => i.arvore.latitude != null).length ?? 0} posições serão substituídas</p>
          {preview?.erros.length ? <div role="alert" className="space-y-1 text-sm text-destructive">{preview.erros.map((e, i) => <p key={i}>{e}</p>)}</div> : null}
          <div className="max-h-64 overflow-y-auto divide-y text-sm">{preview?.atualizacoes.map((i) => <div key={i.arvore.id} className="py-2"><strong>Árvore {i.arvore.numero} · {i.arvore.nome_vulgar}</strong><p className="text-muted-foreground">{i.latitude.toFixed(6)}, {i.longitude.toFixed(6)}</p></div>)}</div>
        </>}
        <Button disabled={busy || !configurado || !!preview?.erros.length || !preview?.atualizacoes.length} onClick={salvar}><Check />{busy ? "Salvando…" : "Confirmar coordenadas"}</Button>
      </DialogContent>
    </Dialog>
  </>;
}
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Tora } from "@/lib/data";
import { salvarArquivo, type ArquivoGerado } from "@/lib/arquivo";
import { ORDENS, exportarExcel, exportarPdf, exportarSinaflor, type Ordem, type MedidaRelatorio } from "@/lib/relatorio";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Download, ExternalLink, FileSpreadsheet, FileText, LoaderCircle } from "lucide-react";

export function RelatorioToras({ lista, selecionadas, ordem, setOrdem, titulo, medida = "fisica" }: { lista: Tora[]; selecionadas: number[]; ordem: Ordem; setOrdem: (o: Ordem) => void; titulo: string; medida?: MedidaRelatorio }) {
  const [gerando, setGerando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<(ArquivoGerado & { url: string }) | null>(null);
  const itens = selecionadas.length ? lista.filter((t) => selecionadas.includes(t.plaqueta)) : lista;
  useEffect(() => {
    if (!arquivo) return;
    return () => { setTimeout(() => URL.revokeObjectURL(arquivo.url), 30_000); };
  }, [arquivo]);
  async function gerar(formato: "excel" | "pdf" | "sinaflor") {
    if (gerando || !itens.length) return;
    setGerando(true); setArquivo(null); setAberto(true);
    try {
      const resultado = await (formato === "pdf" ? exportarPdf(itens, titulo, medida) : formato === "excel" ? exportarExcel(itens) : exportarSinaflor(itens));
      setArquivo({ ...resultado, url: URL.createObjectURL(resultado.blob) });
    } catch (error) {
      setAberto(false);
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o relatório. Tente novamente.");
    } finally { setGerando(false); }
  }
  return <>
    <div className="border-y py-3 space-y-2">
      <label className="text-xs space-y-1 block">Ordenar por
        <select aria-label="Ordenar toras" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className="w-full h-10 rounded-md border bg-background px-2 text-sm">
          {ORDENS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
      </label>
      <div className="text-xs text-muted-foreground">Relatório: {itens.length} toras {selecionadas.length ? "selecionadas" : "do filtro"}</div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={!itens.length || gerando} onClick={() => gerar("excel")}><FileSpreadsheet /> Excel</Button>
        <Button variant="outline" disabled={!itens.length || gerando} onClick={() => gerar("pdf")}><FileText /> PDF</Button>
        <Button variant="outline" className="col-span-2" disabled={!itens.length || gerando} onClick={() => gerar("sinaflor")}><FileSpreadsheet /> Exportar para SINAFLOR (repique)</Button>
      </div>
    </div>
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{gerando ? "Gerando relatório…" : "Relatório pronto"}</DialogTitle><DialogDescription className="break-all">{arquivo?.nome ?? "Preparando o arquivo"}</DialogDescription></DialogHeader>
        {gerando && <LoaderCircle className="mx-auto animate-spin" aria-label="Gerando arquivo" />}
        {arquivo && <div className="space-y-2">
          <Button className="w-full" onClick={() => { salvarArquivo(arquivo).catch(() => toast.error("Não foi possível salvar o arquivo. Tente novamente.")); }}><Download /> Salvar arquivo</Button>
          {arquivo.blob.type === "application/pdf" && <Button asChild variant="outline" className="w-full"><a href={arquivo.url} target="_blank" rel="noopener noreferrer"><ExternalLink /> Abrir PDF</a></Button>}
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
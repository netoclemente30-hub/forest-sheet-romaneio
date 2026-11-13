import { useState } from "react";
import { Download, FileSpreadsheet, FileText, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { salvarArquivo, type ArquivoGerado } from "@/lib/arquivo";
import { exportarSaldoPendenteExcel, exportarSaldoPendentePdf, type SaldoPendente } from "@/lib/saldo-pendentes";

export function ExportarSaldoPendente({ lista, carregando }: { lista: SaldoPendente[]; carregando: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [arquivo, setArquivo] = useState<ArquivoGerado | null>(null);
  async function gerar(pdf: boolean) {
    setAberto(true); setGerando(true); setArquivo(null);
    try { setArquivo(await (pdf ? exportarSaldoPendentePdf(lista) : exportarSaldoPendenteExcel(lista))); }
    catch { setAberto(false); toast.error("Não foi possível exportar as toras não medidas."); }
    finally { setGerando(false); }
  }
  return <>
    <div className="border-y py-3 space-y-2">
      <p className="text-sm font-semibold">Toras não medidas · {carregando ? "…" : lista.length}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={carregando || gerando || !lista.length} onClick={() => void gerar(false)}><FileSpreadsheet /> Exportar Excel</Button>
        <Button variant="outline" disabled={carregando || gerando || !lista.length} onClick={() => void gerar(true)}><FileText /> Exportar PDF</Button>
      </div>
    </div>
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{gerando ? "Gerando relatório…" : "Relatório pronto"}</DialogTitle><DialogDescription className="break-all">{arquivo?.nome ?? "Toras não medidas"}</DialogDescription></DialogHeader>
        {gerando && <LoaderCircle className="mx-auto animate-spin" aria-label="Gerando arquivo" />}
        {arquivo && <Button onClick={() => void salvarArquivo(arquivo).catch(() => toast.error("Não foi possível salvar o arquivo."))}><Download /> Salvar arquivo</Button>}
      </DialogContent>
    </Dialog>
  </>;
}
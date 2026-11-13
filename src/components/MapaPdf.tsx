import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ExternalLink, FileText, LoaderCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { salvarArquivo, type ArquivoGerado } from "@/lib/arquivo";
import { getEmpresaAtiva } from "@/lib/empresa";
import { baixarMapaPdf, enviarMapaPdf, mapaPdfQuery } from "@/lib/mapa-pdf";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function tamanho(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function MapaPdf({ autex, encerrado }: { autex: string; encerrado: boolean }) {
  const qc = useQueryClient();
  const { empresaId, session } = useAuth();
  const empresa = getEmpresaAtiva() ?? empresaId;
  const consulta = useQuery({ ...mapaPdfQuery(autex), enabled: !!autex });
  const mapa = consulta.data?.[0] ?? null;
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<(ArquivoGerado & { url: string }) | null>(null);

  useEffect(() => {
    if (!arquivo) return;
    return () => { setTimeout(() => URL.revokeObjectURL(arquivo.url), 30_000); };
  }, [arquivo]);

  async function enviar(file: File | undefined) {
    if (!file || enviando) return;
    if (!empresa) { toast.error("Aguarde carregar a empresa"); return; }
    setEnviando(true);
    try {
      const salvo = await enviarMapaPdf({ file, autex, empresa, atual: mapa, userId: session?.user.id ?? null });
      qc.setQueryData(mapaPdfQuery(autex).queryKey, [salvo]);
      await qc.invalidateQueries({ queryKey: mapaPdfQuery(autex).queryKey });
      toast.success(mapa ? "PDF do mapa substituído" : "PDF do mapa enviado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o PDF");
    } finally {
      setEnviando(false);
    }
  }

  async function preparar() {
    if (!mapa || preparando) return;
    setPreparando(true);
    setArquivo(null);
    setAberto(true);
    try {
      const resultado = await baixarMapaPdf(mapa);
      setArquivo({ ...resultado, url: URL.createObjectURL(resultado.blob) });
    } catch (error) {
      setAberto(false);
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o PDF");
    } finally {
      setPreparando(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-3" aria-labelledby={`titulo-pdf-${autex}`}>
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 size-6 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 id={`titulo-pdf-${autex}`} className="font-semibold">PDF do mapa de exploração</h2>
          <p className="text-xs text-muted-foreground">Anexe a planta com picadas, árvores e legenda desta AUTEX.</p>
        </div>
      </div>

      {mapa ? (
        <div className="rounded-lg bg-secondary p-3 text-sm">
          <div className="break-words font-medium">{mapa.nome_arquivo}</div>
          <div className="mt-1 text-xs text-muted-foreground">{tamanho(mapa.tamanho_bytes)} · atualizado em {new Date(mapa.atualizado_em).toLocaleString("pt-BR")}</div>
        </div>
      ) : !consulta.isLoading ? (
        <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">Nenhum PDF anexado a esta AUTEX.</p>
      ) : <p className="text-sm text-muted-foreground">Carregando PDF…</p>}

      <div className={`grid gap-2 ${mapa && !encerrado ? "grid-cols-2" : "grid-cols-1"}`}>
        {mapa && <Button disabled={preparando} onClick={preparar}>{preparando ? <LoaderCircle className="animate-spin" /> : <FileText />}{preparando ? "Carregando…" : "Abrir PDF"}</Button>}
        {!encerrado && <>
          <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" aria-label={`Selecionar PDF do mapa da AUTEX ${autex}`} onChange={(e) => { void enviar(e.target.files?.[0]); }} />
          <Button variant={mapa ? "outline" : "default"} disabled={enviando} onClick={() => { if (input.current) { input.current.value = ""; input.current.click(); } }}>
            {enviando ? <LoaderCircle className="animate-spin" /> : <Upload />}{enviando ? "Enviando…" : mapa ? "Substituir PDF" : "Enviar PDF do mapa"}
          </Button>
        </>}
      </div>
      {!encerrado && <p className="text-xs text-muted-foreground">Somente PDF, até 100 MB. O envio precisa de internet; o arquivo é compartilhado somente com esta empresa.</p>}
      {encerrado && mapa && <p className="text-xs text-muted-foreground">Manejo encerrado: o PDF permanece disponível para consulta.</p>}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] max-w-5xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{preparando ? "Carregando PDF…" : "PDF do mapa pronto"}</DialogTitle>
            <DialogDescription className="break-words">AUTEX {autex} · {arquivo?.nome ?? mapa?.nome_arquivo ?? "Preparando o arquivo"}</DialogDescription>
          </DialogHeader>
          {preparando && <LoaderCircle className="mx-auto size-8 animate-spin" aria-label="Carregando PDF" />}
          {arquivo && <>
            <iframe title={`Mapa em PDF da AUTEX ${autex}`} src={arquivo.url} className="hidden min-h-0 flex-1 rounded-md border sm:block" />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={() => { salvarArquivo(arquivo).catch(() => toast.error("Não foi possível salvar o PDF. Tente novamente.")); }}><Download /> Salvar arquivo</Button>
              <Button asChild variant="outline"><a href={arquivo.url} target="_blank" rel="noopener noreferrer"><ExternalLink /> Abrir em nova guia</a></Button>
            </div>
            <p className="text-center text-xs text-muted-foreground sm:hidden">Use “Abrir em nova guia” para visualizar a planta completa.</p>
          </>}
        </DialogContent>
      </Dialog>
    </section>
  );
}

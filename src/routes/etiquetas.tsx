import { Capacitor } from "@capacitor/core";
import { baixarArquivo, compartilharArquivoExato } from "@/lib/arquivo";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fila } from "@/lib/offline/fila";
import { sincronizar } from "@/lib/offline/sync";
import { capturarLog } from "@/lib/registro";
import { pode } from "@/lib/funcoes";
import { torasQuery } from "@/lib/data";
import { ToraLabel } from "@/components/ToraLabel";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useFilaOffline } from "@/hooks/useFilaOffline";
import { useAuth } from "@/hooks/useAuth";
import { getEmpresaAtiva } from "@/lib/empresa";
import { empresaDaOperacao } from "@/lib/cadastros-empresa";
import { selecionarToraParaQr } from "@/lib/tora-qr";
import { torasEtiquetasOffline } from "@/lib/encaixe-salvar";
import { Input } from "@/components/ui/input";
import { TAMANHOS_PADRAO, gerarEtiquetasPdf, ordenarEtiquetasPorLancamento, tamanhoValido, type TamanhoEtiqueta } from "@/lib/etiqueta-pdf";

export const Route = createFileRoute("/etiquetas")({
  staticData: { sitemap: false },
  validateSearch: (s: Record<string, unknown>) => ({ p: typeof s["p"] === "string" ? s["p"] : String(s["p"] ?? "") }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Etiquetas QR — Manejo Florestal" },
      { name: "description", content: "Imprima etiquetas com QR code para colar nas toras." },
      { property: "og:title", content: "Etiquetas QR — Manejo Florestal" },
      { property: "og:description", content: "Imprima etiquetas com QR code para colar nas toras." },
    ],
  }),
  component: Etiquetas,
});

function Etiquetas() {
  const { p } = Route.useSearch();
  const router = useRouter();
  const toras = useQuery(torasQuery);
  const qc = useQueryClient();
  const { empresaId, isSuperAdmin, papel } = useAuth();
  const pendentes = useFilaOffline();
  const empresa = empresaDaOperacao(isSuperAdmin, empresaId, getEmpresaAtiva());
  const locais = torasEtiquetasOffline(pendentes.itens, empresa);
  const disponiveis = empresa
    ? [...(toras.data ?? []).filter((t) => t.empresa_id === empresa), ...locais.filter((t) => t.empresa_id === empresa)]
    : [];
  const lista = [...new Set(p.split(",").map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))];
  const selecionadas = ordenarEtiquetasPorLancamento(lista.flatMap((pl) => {
    const t = selecionarToraParaQr(disponiveis, empresa, pl);
    return t ? [t] : [];
  }));
  const [tam, setTam] = useState<TamanhoEtiqueta>({ largura: 100, altura: 70 });
  const [busy, setBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem("etiqueta-tamanho") ?? "null"); if (v && tamanhoValido(v)) setTam(v); } catch { /* ignora */ }
  }, []);
  function escolher(t: TamanhoEtiqueta) { setTam(t); if (tamanhoValido(t)) localStorage.setItem("etiqueta-tamanho", JSON.stringify(t)); }
  async function gerar(salvar = false) {
    if (!empresa) { toast.error("Selecione a empresa antes de gerar etiquetas QR"); return; }
    if (!tamanhoValido(tam)) { toast.error("Informe largura e altura entre 25 e 300 mm"); return; }
    setBusy(true);
    try {
      const doc = await gerarEtiquetasPdf(selecionadas, tam);
      const nome = `etiquetas-${tam.largura}x${tam.altura}mm.pdf`;
      if (pode(papel, "toras_lancar") || pode(papel, "serraria_operar")) {
        const plaquetas = selecionadas.map(t => t.plaqueta);
        try {
          const log = await capturarLog("Etiqueta emitida", plaquetas.join(", "));
          await fila().enfileirar({ tipo: "toras_etiquetas", empresa_id: empresa, plaquetas, log });
          void sincronizar(fila()).then(() => qc.invalidateQueries({ queryKey: ["toras"] })).catch(() => {});
        } catch {
          toast.warning("O PDF foi gerado. O status de emissão não pôde ser gravado neste aparelho.");
        }
      }
      const blob = doc.output("blob");
      const arquivo = { blob, nome };
      if (!Capacitor.isNativePlatform()) {
        setPdfUrl((anterior) => {
          if (anterior) URL.revokeObjectURL(anterior);
          return URL.createObjectURL(blob);
        });
      }
      if (salvar) await baixarArquivo(arquivo);
      else await compartilharArquivoExato(arquivo);
    } catch (e) { console.error(e); toast.error("Não foi possível gerar o arquivo"); }
    setBusy(false);
  }
  return (
    <div>
      <div className="no-print space-y-3 mb-4">
        {!empresa && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">Selecione a empresa no topo antes de gerar etiquetas; plaquetas podem se repetir em empresas diferentes.</p>}
        {empresa && lista.length > 0 && selecionadas.length !== lista.length && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">Uma ou mais plaquetas não foram encontradas na empresa selecionada. Nenhuma etiqueta de outra empresa será utilizada.</p>}
        <Button variant="outline" onClick={() => router.history.back()}><ArrowLeft /> Voltar</Button>
        <div className="rounded-xl border bg-card p-3 space-y-2">
          <p className="font-semibold">Tamanho da etiqueta (mm)</p>
          <div className="flex flex-wrap gap-2">
            {TAMANHOS_PADRAO.map((t) => {
              const ativo = t.largura === tam.largura && t.altura === tam.altura;
              return <Button key={`${t.largura}x${t.altura}`} size="sm" variant={ativo ? "default" : "outline"} onClick={() => escolher(t)}>{t.largura}×{t.altura}</Button>;
            })}
          </div>
          <div className="flex items-center gap-2">
            <Input aria-label="Largura em mm" type="number" inputMode="numeric" value={tam.largura || ""} onChange={(e) => escolher({ ...tam, largura: Number(e.target.value) })} className="h-11" />
            <span>×</span>
            <Input aria-label="Altura em mm" type="number" inputMode="numeric" value={tam.altura || ""} onChange={(e) => escolher({ ...tam, altura: Number(e.target.value) })} className="h-11" />
            <span className="text-sm text-muted-foreground">mm</span>
          </div>
          <p className="text-xs text-muted-foreground">Gera um PDF com uma etiqueta por página, no tamanho exato. Na impressão, use "Tamanho real / 100%".</p>
        </div>
        <Button disabled={!empresa || !selecionadas.length || selecionadas.length !== lista.length || toras.isLoading || busy} className="w-full h-12" onClick={() => gerar()}><Printer /> {busy ? "Gerando…" : `Gerar PDF de ${selecionadas.length} etiqueta(s)`}</Button>
        <Button variant="outline" disabled={!empresa || !selecionadas.length || selecionadas.length !== lista.length || toras.isLoading || busy} className="w-full h-12" onClick={() => gerar(true)}><Download /> Salvar PDF no aparelho</Button>
        {pdfUrl && <a href={pdfUrl} target="_blank" rel="noopener" className="block text-center underline font-semibold py-2">Abrir PDF</a>}
      </div>
      {toras.isLoading && <p>Carregando etiquetas…</p>}
      {toras.isError && <p className="text-destructive">Não foi possível carregar as etiquetas.</p>}
      <div className="label-sheet">
        {selecionadas.map((t) => <ToraLabel key={t.plaqueta} tora={t} />)}
      </div>
    </div>
  );
}

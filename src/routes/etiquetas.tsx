import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { torasQuery } from "@/lib/data";
import { ToraLabel } from "@/components/ToraLabel";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { TAMANHOS_PADRAO, gerarEtiquetasPdf, tamanhoValido, type TamanhoEtiqueta } from "@/lib/etiqueta-pdf";

export const Route = createFileRoute("/etiquetas")({
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
  const lista = [...new Set(p.split(",").map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))];
  const selecionadas = lista.flatMap((pl) => { const t = toras.data?.find((x) => x.plaqueta === pl); return t ? [t] : []; });
  const [tam, setTam] = useState<TamanhoEtiqueta>({ largura: 100, altura: 70 });
  const [busy, setBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem("etiqueta-tamanho") ?? "null"); if (v && tamanhoValido(v)) setTam(v); } catch { /* ignora */ }
  }, []);
  function escolher(t: TamanhoEtiqueta) { setTam(t); if (tamanhoValido(t)) localStorage.setItem("etiqueta-tamanho", JSON.stringify(t)); }
  async function gerar() {
    if (!tamanhoValido(tam)) { toast.error("Informe largura e altura entre 25 e 300 mm"); return; }
    setBusy(true);
    try {
      const doc = await gerarEtiquetasPdf(selecionadas, tam);
      const nome = `etiquetas-${tam.largura}x${tam.altura}mm.pdf`;
      const blob = doc.output("blob");
      const file = new File([blob], nome, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: nome }); setBusy(false); return; }
        catch (e) { if ((e as Error).name === "AbortError") { setBusy(false); return; } }
      }
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      const a = document.createElement("a");
      a.href = url; a.download = nome; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      toast.success("PDF gerado — se não baixar, toque em \"Abrir PDF\"");
    } catch (e) { console.error(e); toast.error("Não foi possível gerar o arquivo"); }
    setBusy(false);
  }
  return (
    <div>
      <div className="no-print space-y-3 mb-4">
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
        <Button disabled={!selecionadas.length || toras.isLoading || busy} className="w-full h-12" onClick={gerar}><Printer /> {busy ? "Gerando…" : `Gerar PDF de ${selecionadas.length} etiqueta(s)`}</Button>
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

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, FileSpreadsheet, Download } from "lucide-react";
import { romaneiosQuery, torasQuery } from "@/lib/data";
import { madeiraQuery, cargasSerradasQuery } from "@/lib/madeira-serrada";
import { useAuth } from "@/hooks/useAuth";
import { getEmpresaAtiva } from "@/lib/empresa";
import { exportarTabelasExcel, exportarTabelasPdf, tabelaEstoque, tabelaRendimento, tabelaRomaneios, type Tabela } from "@/lib/relatorios-gerais";
import { salvarArquivo, type ArquivoGerado } from "@/lib/arquivo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Relatórios — Manejo Florestal" },
      { name: "description", content: "Rendimento do desdobro, romaneios emitidos e estoque consolidado em PDF ou Excel." },
      { property: "og:title", content: "Relatórios — Manejo Florestal" },
      { property: "og:description", content: "Rendimento do desdobro, romaneios emitidos e estoque consolidado em PDF ou Excel." },
    ],
  }),
  component: Relatorios,
});

type Tipo = "rendimento" | "romaneios" | "estoque";
const NOMES: Record<Tipo, string> = { rendimento: "Rendimento do desdobro", romaneios: "Romaneios emitidos", estoque: "Estoque consolidado" };

function Relatorios() {
  const { empresaId } = useAuth();
  const empresa = getEmpresaAtiva() ?? empresaId;
  const toras = useQuery(torasQuery);
  const roms = useQuery(romaneiosQuery);
  const pacotes = useQuery(madeiraQuery(empresa));
  const cargas = useQuery(cargasSerradasQuery(empresa));
  const [tipo, setTipo] = useState<Tipo>("rendimento");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [especie, setEspecie] = useState("");
  const [busy, setBusy] = useState(false);
  const [arquivo, setArquivo] = useState<ArquivoGerado | null>(null);

  const especies = useMemo(() => {
    const s = new Set<string>();
    for (const t of toras.data ?? []) if (t.especie?.trim()) s.add(t.especie.trim());
    for (const p of pacotes.data ?? []) for (const i of p.itens) if (i.especie.trim()) s.add(i.especie.trim());
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [toras.data, pacotes.data]);

  const tabelas: Tabela[] = useMemo(() => {
    const p = { inicio, fim, especie };
    if (tipo === "rendimento") return tabelaRendimento(toras.data ?? [], pacotes.data ?? [], p);
    if (tipo === "romaneios") return tabelaRomaneios(roms.data ?? [], cargas.data ?? [], p);
    return tabelaEstoque(toras.data ?? [], roms.data ?? [], pacotes.data ?? [], especie);
  }, [tipo, inicio, fim, especie, toras.data, pacotes.data, roms.data, cargas.data]);

  const carregando = toras.isLoading || roms.isLoading || pacotes.isLoading || cargas.isLoading;
  const filtro = [inicio || fim ? `Período: ${inicio ? inicio.split("-").reverse().join("/") : "início"} a ${fim ? fim.split("-").reverse().join("/") : "hoje"}` : "", especie ? `Espécie: ${especie}` : ""].filter((x, i) => x && !(tipo === "estoque" && i === 0)).join(" · ");

  async function gerar(formato: "pdf" | "xlsx") {
    setBusy(true); setArquivo(null);
    try { setArquivo(formato === "pdf" ? await exportarTabelasPdf(NOMES[tipo], filtro, tabelas) : await exportarTabelasExcel(NOMES[tipo], tabelas)); }
    catch { toast.error("Não foi possível gerar o relatório."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Relatórios</h1>
      <Tabs value={tipo} onValueChange={(v) => { setTipo(v as Tipo); setArquivo(null); }}>
        <TabsList className="w-full h-auto grid grid-cols-3">
          <TabsTrigger value="rendimento" className="whitespace-normal">Rendimento</TabsTrigger>
          <TabsTrigger value="romaneios" className="whitespace-normal">Romaneios</TabsTrigger>
          <TabsTrigger value="estoque" className="whitespace-normal">Estoque</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid grid-cols-2 gap-2">
        {tipo !== "estoque" && <>
          <label className="text-xs text-muted-foreground">De<Input type="date" value={inicio} onChange={(e) => { setInicio(e.target.value); setArquivo(null); }} /></label>
          <label className="text-xs text-muted-foreground">Até<Input type="date" value={fim} onChange={(e) => { setFim(e.target.value); setArquivo(null); }} /></label>
        </>}
        {tipo !== "romaneios" && (
          <label className="col-span-2 text-xs text-muted-foreground">Espécie
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={especie} onChange={(e) => { setEspecie(e.target.value); setArquivo(null); }}>
              <option value="">Todas as espécies</option>
              {especies.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
        )}
      </div>
      {tipo === "rendimento" && <p className="text-xs text-muted-foreground">Rendimento = madeira serrada produzida (pacotes, pela data do pacote) ÷ volume das toras serradas (pela data da baixa) × 100.</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={busy || carregando} onClick={() => gerar("pdf")}><FileText /> Gerar PDF</Button>
        <Button variant="outline" disabled={busy || carregando} onClick={() => gerar("xlsx")}><FileSpreadsheet /> Gerar Excel</Button>
      </div>
      {arquivo && <Button className="w-full" onClick={() => { salvarArquivo(arquivo).catch(() => toast.error("Não foi possível salvar o arquivo. Tente novamente.")); }}><Download /> Salvar {arquivo.nome}</Button>}
      {carregando ? <p className="text-sm text-muted-foreground">Carregando dados…</p> : tabelas.map((t) => (
        <section key={t.titulo} className="space-y-1">
          <h2 className="font-semibold">{t.titulo}</h2>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-xs">
              <thead className="bg-muted"><tr>{t.cabecalho.map((h) => <th key={h} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {t.linhas.length === 0 && <tr><td colSpan={t.cabecalho.length} className="px-2 py-3 text-muted-foreground">Sem registros para os filtros.</td></tr>}
                {t.linhas.map((l, i) => <tr key={i} className="border-t">{l.map((c, j) => <td key={j} className="px-2 py-1.5 whitespace-nowrap">{c}</td>)}</tr>)}
              </tbody>
              {t.rodape && t.linhas.length > 0 && <tfoot className="bg-secondary font-semibold"><tr>{t.rodape.map((c, j) => <td key={j} className="px-2 py-1.5 whitespace-nowrap">{c}</td>)}</tr></tfoot>}
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

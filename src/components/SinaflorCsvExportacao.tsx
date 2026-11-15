import { useMemo, useState } from "react";
import { Download, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import type { Arvore, Tora } from "@/lib/data";
import { getEmpresaAtiva } from "@/lib/empresa";
import { useAuth } from "@/hooks/useAuth";
import { salvarArquivo } from "@/lib/arquivo";
import {
  exportarAbatidasCsv, exportarTracadasCsv, selecionarAbatidas, selecionarTracadas,
  type FiltroSinaflor,
} from "@/lib/sinaflor-csv";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

function diaHoje(): string {
  const d = new Date();
  const n = (v: number) => String(v).padStart(2, "0");
  return [d.getFullYear(), n(d.getMonth() + 1), n(d.getDate())].join("-");
}

/**
 * CSV de declaração de corte e CSV de traçamento.
 * O registro do cortador já atualiza arvore.abatida_em (inclusive quando offline);
 * esta tela exporta o mesmo registro após sincronização.
 */
export function SinaflorCsvExportacao({
  arvores, toras, autexFixa, apenasAbatidas = false,
}: {
  arvores: Arvore[];
  toras: Tora[];
  autexFixa?: string;
  apenasAbatidas?: boolean;
}) {
  const { empresaId, isSuperAdmin } = useAuth();
  const empresa = getEmpresaAtiva() ?? empresaId ?? "";
  const [autexEscolhida, setAutexEscolhida] = useState("");
  const [inicio, setInicio] = useState(diaHoje);
  const [fim, setFim] = useState(diaHoje);
  const [ocupado, setOcupado] = useState(false);
  const autex = autexFixa ?? autexEscolhida;
  const precisaEmpresa = isSuperAdmin && !getEmpresaAtiva();
  const autexDisponiveis = useMemo(
    () => [...new Set([
      ...arvores.filter((a) => a.empresa_id === empresa).map((a) => a.autex),
      ...toras.filter((t) => t.empresa_id === empresa && t.origem === "manejo").map((t) => t.autex ?? ""),
    ])].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [arvores, toras, empresa],
  );

  const filtro: FiltroSinaflor = { empresaId: empresa, autex, inicio, fim };
  const pronto = !!empresa && !!autex && !!inicio && !!fim && inicio <= fim && !precisaEmpresa;
  const abatidas = pronto ? selecionarAbatidas(arvores, filtro) : [];
  const tracadas = pronto ? selecionarTracadas(toras, filtro) : { validas: [], incompletas: [], duplicadas: [] };
  const incompletas = tracadas.incompletas.length;
  const duplicadas = tracadas.duplicadas.length;

  async function gerar(tipo: "abatidas" | "tracadas") {
    if (ocupado || !pronto) return;
    if (!navigator.onLine) {
      toast.error("Conecte à internet e sincronize os lançamentos antes de gerar o CSV para o SINAFLOR.");
      return;
    }
    setOcupado(true);
    try {
      // Um abate ainda na fila do mapa não deve ser declarado como sincronizado.
      const { fila } = await import("@/lib/offline/fila");
      const pendentes = (await fila().listar()).filter((x) =>
        x.op.tipo === "arvore_gps" && x.op.empresa_id === empresa && x.op.autex === autex);
      if (pendentes.length) {
        throw new Error("Existem " + pendentes.length + " registros do mapa sem sincronização. Sincronize antes de gerar o CSV.");
      }
      const arquivo = tipo === "abatidas"
        ? exportarAbatidasCsv(arvores, filtro)
        : exportarTracadasCsv(toras, filtro);
      await salvarArquivo(arquivo);
      toast.success("CSV preparado. Confira o período antes de enviar ao SINAFLOR.");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao gerar o arquivo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="rounded-xl border bg-card p-3 space-y-3" aria-label="Arquivos CSV SINAFLOR">
      <div className="flex items-start gap-2">
        <FileSpreadsheet className="size-5 shrink-0 text-primary" />
        <div>
          <h2 className="font-semibold">SINAFLOR — corte e traçamento</h2>
          <p className="text-xs text-muted-foreground">CSV no formato dos modelos de árvores abatidas e toras traçadas. Uma empresa e AUTEX por arquivo.</p>
        </div>
      </div>
      {precisaEmpresa && <p role="alert" className="text-sm text-destructive">Selecione uma empresa no topo para evitar misturar dados de empresas diferentes.</p>}
      {autexFixa ? <p className="text-sm font-semibold">AUTEX: {autexFixa}</p> :
        <label className="block space-y-1 text-xs">AUTEX do arquivo
          <select aria-label="AUTEX para exportação SINAFLOR" value={autexEscolhida} onChange={(e) => setAutexEscolhida(e.target.value)}
            className="h-11 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Selecione uma AUTEX</option>
            {autexDisponiveis.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>}
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs">Data inicial
          <Input type="date" aria-label="Data inicial SINAFLOR" value={inicio} max={fim || undefined} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs">Data final
          <Input type="date" aria-label="Data final SINAFLOR" value={fim} min={inicio || undefined} onChange={(e) => setFim(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Árvores filtradas pela data do abate no mapa; toras filtradas pela data do lançamento da medição. As duas datas são inclusivas.</p>
      <div className="grid gap-2">
        <Button type="button" disabled={!pronto || !abatidas.length || ocupado} onClick={() => void gerar("abatidas")}>
          <Download className="size-4" /> CSV árvores abatidas ({abatidas.length})
        </Button>
        {!apenasAbatidas && <Button type="button" variant="outline" disabled={!pronto || !tracadas.validas.length || !!incompletas || !!duplicadas || ocupado} onClick={() => void gerar("tracadas")}>
          <FileSpreadsheet className="size-4" /> Traçar SINAFLOR ({tracadas.validas.length} toras)
        </Button>}
      </div>
      {!apenasAbatidas && (incompletas > 0 || duplicadas > 0) && (
        <p role="alert" className="flex gap-1 text-xs text-destructive"><AlertTriangle className="size-4 shrink-0" />
          Corrija {incompletas} tora(s) com medidas ou secção incompletas e {duplicadas} secção(ões) duplicada(s) antes de traçar.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Atenção: filtrar datas e remover repetições do CSV não confirma importação no IBAMA.
        Anote os períodos já enviados; não reimporte o mesmo período sem conferência.
      </p>
    </section>
  );
}

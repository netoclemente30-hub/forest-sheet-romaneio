import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import type { Arvore, Tora } from "@/lib/data";
import { getEmpresaAtiva } from "@/lib/empresa";
import { useAuth } from "@/hooks/useAuth";
import { salvarArquivo } from "@/lib/arquivo";
import {
  exportarAbatidasCsv, exportarTracadasCsv, selecionarAbatidas,
  selecionarTracadas, type FiltroSinaflor,
} from "@/lib/sinaflor-csv";
import {
  chaveSinaflor, gravarEnvios, idAbatida, idTracada, lerEnvios,
  marcarEnvios, pendentesDeEnvio, type ControleEnvios, type TipoEnvio,
} from "@/lib/sinaflor-envios";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

function hojeRondonia(): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Porto_Velho", day: "2-digit", month: "2-digit", year: "numeric",
  }).formatToParts(new Date());
  const n = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return [n("year"), n("month"), n("day")].join("-");
}

/** O mapa registra abatida_em; o controle de envio ao IBAMA é local e manual. */
export function SinaflorCsvExportacao({
  arvores, toras, autexFixa, apenasAbatidas = false,
}: {
  arvores: Arvore[];
  toras: Tora[];
  autexFixa?: string;
  apenasAbatidas?: boolean;
}) {
  const { empresaId, isSuperAdmin, session } = useAuth();
  const empresaAtiva = getEmpresaAtiva();
  const empresa = empresaAtiva ?? empresaId ?? "";
  const usuario = session?.user.id ?? "";
  const [autexEscolhida, setAutexEscolhida] = useState("");
  const [inicio, setInicio] = useState(hojeRondonia);
  const [fim, setFim] = useState(hojeRondonia);
  const [ocupado, setOcupado] = useState(false);
  const [incluirEnviados, setIncluirEnviados] = useState(false);
  const [controle, setControle] = useState<ControleEnvios>({ abatidas: [], tracadas: [] });
  const [ultimo, setUltimo] = useState<{ chave: string; periodo: string; tipo: TipoEnvio; ids: string[] } | null>(null);

  const autex = autexFixa ?? autexEscolhida;
  const precisaEmpresa = isSuperAdmin && !empresaAtiva;
  const chave = usuario && empresa && autex ? chaveSinaflor(usuario, empresa, autex) : "";
  const periodo = inicio + "|" + fim;
  const autexDisponiveis = useMemo(
    () => [...new Set([
      ...arvores.filter((a) => a.empresa_id === empresa).map((a) => a.autex),
      ...toras.filter((t) => t.empresa_id === empresa && t.origem === "manejo").map((t) => t.autex ?? ""),
    ])].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [arvores, toras, empresa],
  );

  useEffect(() => {
    setControle(lerEnvios(chave));
    setUltimo(null);
    setIncluirEnviados(false);
  }, [chave]);

  const filtro: FiltroSinaflor = { empresaId: empresa, autex, inicio, fim };
  const pronto = !!usuario && !!empresa && !!autex && !!inicio && !!fim && inicio <= fim && !precisaEmpresa;
  const abatidas = pronto ? selecionarAbatidas(arvores, filtro) : [];
  const tracadas = pronto && !apenasAbatidas
    ? selecionarTracadas(toras, filtro)
    : { validas: [] as Tora[], incompletas: [] as Tora[], duplicadas: [] as Tora[] };
  const pendentesAbate = pendentesDeEnvio(abatidas, controle.abatidas, idAbatida);
  const pendentesTracamento = pendentesDeEnvio(tracadas.validas, controle.tracadas, idTracada);
  const selecionadasAbate = incluirEnviados ? abatidas : pendentesAbate;
  const selecionadasTracamento = incluirEnviados ? tracadas.validas : pendentesTracamento;
  const marcadasAbate = abatidas.length - pendentesAbate.length;
  const marcadasTracamento = tracadas.validas.length - pendentesTracamento.length;
  const incompletas = tracadas.incompletas.length;
  const duplicadas = tracadas.duplicadas.length;

  async function gerar(tipo: TipoEnvio) {
    if (ocupado || !pronto) return;
    if (!navigator.onLine) {
      toast.error("Conecte-se e sincronize os lançamentos antes de gerar o arquivo do SINAFLOR.");
      return;
    }
    setOcupado(true);
    setUltimo(null);
    try {
      const { fila } = await import("@/lib/offline/fila");
      const pendentes = (await fila().listar()).filter((item) => {
        const op = item.op;
        if (op.tipo === "arvore_gps") return op.empresa_id === empresa && op.autex === autex;
        if (tipo === "tracadas") {
          if (op.tipo === "tora_insert")
            return String(op.dados["autex"] ?? "") === autex
              && (!op.dados["empresa_id"] || op.dados["empresa_id"] === empresa);
          if (op.tipo === "tora_update" || op.tipo === "tora_delete")
            return op.empresa_id === empresa;
        }
        return false;
      });
      if (pendentes.length) {
        throw new Error(pendentes.length + " lançamento(s) ainda não sincronizado(s). Sincronize antes de gerar CSV.");
      }
      const itens = tipo === "abatidas" ? selecionadasAbate : selecionadasTracamento;
      if (!itens.length) throw new Error("Nenhum registro novo neste período. Confira o histórico de envios.");
      if (incluirEnviados && !window.confirm("Este arquivo também incluirá registros já marcados como lançados no IBAMA. Deseja gerar mesmo assim?")) return;
      const arquivo = tipo === "abatidas"
        ? exportarAbatidasCsv(selecionadasAbate, filtro)
        : exportarTracadasCsv(selecionadasTracamento, filtro);
      await salvarArquivo(arquivo);
      const ids = tipo === "abatidas"
        ? selecionadasAbate.map(idAbatida) : selecionadasTracamento.map(idTracada);
      setUltimo({ chave, periodo, tipo, ids });
      toast.success("CSV gerado. Marque como lançado somente após confirmar o recebimento no IBAMA.");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao gerar CSV.");
    } finally {
      setOcupado(false);
    }
  }

  function confirmarEnvio() {
    if (!ultimo || ultimo.chave !== chave || ultimo.periodo !== periodo || !usuario) return;
    if (!window.confirm(
      "Você já IMPORTOU e CONFIRMOU no SINAFLOR/IBAMA estes " + ultimo.ids.length + " registros?\n\n" +
      "Marque somente depois que o IBAMA aceitar o envio. O controle fica guardado apenas neste navegador.",
    )) return;
    try {
      const novo = marcarEnvios(lerEnvios(chave), ultimo.tipo, ultimo.ids);
      gravarEnvios(chave, novo);
      setControle(novo);
      setUltimo(null);
      setIncluirEnviados(false);
      toast.success("Lançamento registrado neste aparelho. Os itens serão omitidos em novos CSVs.");
    } catch {
      toast.error("Não foi possível guardar o histórico neste aparelho. Não considere estes itens marcados.");
    }
  }

  return (
    <section className="rounded-xl border bg-card p-3 space-y-3" aria-label="Exportações SINAFLOR">
      <div className="flex items-start gap-2">
        <FileSpreadsheet className="size-5 shrink-0 text-primary" />
        <div>
          <h2 className="font-semibold">{apenasAbatidas ? "CSV de árvores abatidas — SINAFLOR" : "SINAFLOR — abate e traçamento"}</h2>
          <p className="text-xs text-muted-foreground">Arquivos CSV no mesmo layout dos modelos enviados. Uma empresa e AUTEX por arquivo.</p>
        </div>
      </div>
      {precisaEmpresa && <p role="alert" className="text-sm text-destructive">Selecione uma empresa no topo, antes de exportar.</p>}
      {autexFixa
        ? <p className="text-sm font-semibold">AUTEX: {autexFixa}</p>
        : <label className="block space-y-1 text-xs">AUTEX do arquivo
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
      <p className="text-xs text-muted-foreground">Árvore: data do abate no mapa. Tora: data da medição lançada no estoque. Período inclusivo, no horário de Rondônia.</p>
      <div className="rounded-md bg-secondary p-2 text-xs space-y-1">
        <p>Árvores abatidas: <strong>{abatidas.length}</strong> · novas: <strong>{pendentesAbate.length}</strong> · marcadas: {marcadasAbate}</p>
        {!apenasAbatidas && <p>Toras traçadas: <strong>{tracadas.validas.length}</strong> · novas: <strong>{pendentesTracamento.length}</strong> · marcadas: {marcadasTracamento}</p>}
      </div>
      {(marcadasAbate > 0 || (!apenasAbatidas && marcadasTracamento > 0)) &&
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={incluirEnviados} onChange={(e) => setIncluirEnviados(e.target.checked)} />
          Incluir registros já marcados como enviados (reexportar)
        </label>}
      <div className="grid gap-2">
        <Button type="button" disabled={!pronto || !selecionadasAbate.length || ocupado} onClick={() => void gerar("abatidas")}>
          <Download className="size-4" /> CSV árvores abatidas ({selecionadasAbate.length})
        </Button>
        {!apenasAbatidas && <Button type="button" variant="outline"
          disabled={!pronto || !selecionadasTracamento.length || !!incompletas || !!duplicadas || ocupado}
          onClick={() => void gerar("tracadas")}>
          <FileSpreadsheet className="size-4" /> Traçar SINAFLOR ({selecionadasTracamento.length} toras)
        </Button>}
      </div>
      {!!ultimo && ultimo.chave === chave && ultimo.periodo === periodo && (
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-sm">Arquivo gerado: {ultimo.ids.length} registros. <strong>O download não confirma lançamento no IBAMA.</strong></p>
          <Button type="button" variant="secondary" className="w-full" onClick={confirmarEnvio}>
            <CheckCircle2 className="size-4" /> Já lancei e confirmei no IBAMA
          </Button>
        </div>
      )}
      {!apenasAbatidas && (incompletas > 0 || duplicadas > 0) && (
        <p role="alert" className="flex gap-1 text-xs text-destructive"><AlertTriangle className="size-4 shrink-0" />
          Corrija {incompletas} tora(s) com medidas/secção incompletas e {duplicadas} secção(ões) duplicada(s) antes de exportar.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Registros marcados como lançados são omitidos, inclusive em períodos sobrepostos.
        O histórico é local deste navegador e não é sincronizado com outros aparelhos nem com o IBAMA.
        Confira o processamento do SINAFLOR antes de confirmar o envio.
      </p>
    </section>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { volumeTora } from "@/lib/volume";
import { empresaIdGravacao } from "@/lib/empresa";
import { analisarBase, numeroInventario, type ArvoreBase } from "@/lib/import-base";
import { lerPDFInventario } from "@/lib/import-pdf";
import modelo from "@/assets/modelo-base.xlsx.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, Download } from "lucide-react";

export const Route = createFileRoute("/importar")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Importar planilha — Manejo Florestal" },
      { name: "description", content: "Importe fichas de campo PDF e Excel com reconhecimento de colunas, CAP, DAP e picadas." },
      { property: "og:title", content: "Importar planilha — Manejo Florestal" },
      { property: "og:description", content: "Importe o inventário florestal de fichas de campo PDF ou Excel." },
    ],
  }),
  component: Importar,
});

type Row = unknown[];
const n = numeroInventario;

function Importar() {
  const qc = useQueryClient();
  const { isAdmin, isSuperAdmin, loading, permissoesCarregando } = useAuth();
  const podeImportar = isAdmin || isSuperAdmin;
  const nav = useNavigate();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [preparado, setPreparado] = useState<{ arvores: ArvoreBase[]; calc: Row[]; invalidas: number; repetidas: number; arquivo: string } | null>(null);
  const [autexPadrao, setAutexPadrao] = useState("");

  useEffect(() => {
    if (!loading && !permissoesCarregando && !podeImportar) {
      toast.error("Só o administrador pode importar planilhas");
      nav({ to: "/" });
    }
  }, [loading, permissoesCarregando, podeImportar, nav]);

  if (loading || permissoesCarregando || !podeImportar) return null;

  async function processar(file: File) {
    setPreparado(null);
    setBusy(true);
    setStatus("Lendo arquivo…");
    try {
      let resultado: ReturnType<typeof analisarBase>;
      let calc: Row[] = [];
      if (/\.pdf$/i.test(file.name)) resultado = await lerPDFInventario(file, setStatus);
      else {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer());
        const nomes = wb.SheetNames.filter((nome) => nome !== "Calculos_Inventario");
        nomes.sort((a, b) => Number(b.toUpperCase() === "BASE") - Number(a.toUpperCase() === "BASE"));
        resultado = analisarBase([]);
        for (const nome of nomes) {
          const sheet = wb.Sheets[nome];
          if (!sheet) continue;
          const candidato = analisarBase(XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, defval: null }));
          if (candidato.arvores.size) { resultado = candidato; break; }
        }
        const calculos = wb.Sheets["Calculos_Inventario"];
        if (calculos) calc = XLSX.utils.sheet_to_json<Row>(calculos, { header: 1 }).slice(1);
      }
      if (!resultado.arvores.size) throw new Error("Nenhuma árvore reconhecida. Confira as colunas número e nome popular/espécie.");
      setPreparado({ arvores: [...resultado.arvores.values()], calc, invalidas: resultado.invalidas, repetidas: resultado.repetidas, arquivo: file.name });
      setStatus("");
    } catch (e) { toast.error((e as Error).message); setStatus(""); }
    finally { setBusy(false); }
  }

  async function confirmar() {
    if (!preparado) return;
    if (!navigator.onLine) {
      toast.error("A importação de planilha precisa de internet");
      return;
    }
    setBusy(true);
    try {
      const arvores = preparado.arvores.map((a) => ({ ...a, autex: a.autex || autexPadrao.trim() }));
      if (arvores.some((a) => !a.autex)) {
        toast.error("Informe a AUTEX para vincular a ficha ao manejo e ao mapa exploratório");
        setBusy(false);
        return;
      }

      const porNumero = new Map<number, ArvoreBase>();
      for (const a of arvores) if (!porNumero.has(a.numero)) porNumero.set(a.numero, a);
      const toras = new Map<number, Record<string, unknown>>();
      let dup = 0;
      for (const r of preparado.calc) {
        const pl = n(r[0]);
        const arv = n(r[1]);
        if (!pl || arv === null || !porNumero.get(arv)) continue;
        if (toras.has(pl)) { dup++; continue; }
        const m = { d_topo1: n(r[4]), d_topo2: n(r[5]), d_pe1: n(r[6]), d_pe2: n(r[7]), comprimento: n(r[10]) };
        toras.set(pl, {
          plaqueta: pl, arvore: arv, especie: porNumero.get(arv)?.nome_vulgar ?? "Não cadastrada", autex: porNumero.get(arv)?.autex || null,
          secao: r[3] ? String(r[3]) : null, nome_cientifico: porNumero.get(arv)?.nome_cientifico ?? null, ...m, volume: volumeTora(m),
          origem: "manejo", carregada: String(r[12] ?? "").toLowerCase() === "carregada",
        });
      }

      const av = [...arvores.values()];
      const autexes = [...new Set(av.map((a) => a.autex).filter(Boolean))];
      const tv = [...toras.values()];
      const empresaConfigurada = empresaIdGravacao().empresa_id;
      let empresa = empresaConfigurada;
      if (!empresa) {
        const { data, error } = await supabase.rpc("minha_empresa");
        if (error) throw error;
        empresa = data ?? undefined;
      }
      if (!empresa) throw new Error("Selecione uma empresa para a importação.");
      setStatus("Validando a ficha e gravando todas as árvores e toras em uma transação…");
      const { error } = await supabase.rpc("importar_ficha_manejo", {
        _empresa: empresa,
        _arvores: av as unknown as import("@/integrations/supabase/types").Json,
        _toras: tv as unknown as import("@/integrations/supabase/types").Json,
      });
      if (error) throw new Error(error.message);

      await qc.invalidateQueries();
      setStatus(`Pronto! ${av.length} árvores e ${tv.length} toras importadas.${dup ? ` ${dup} plaqueta(s) repetida(s) ignorada(s).` : ""}`);
      toast.success("Ficha importada e vinculada ao manejo");
      setPreparado(null);
      if (autexes.length === 1) nav({ to: "/base/$autex", params: { autex: autexes[0]! } });
      else nav({ to: "/base" });
    } catch (e) {
      toast.error((e as Error).message);
      setStatus("");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold uppercase">Importar planilha</h1>
      <p className="text-sm text-muted-foreground">
        PDF · Excel (.xlsx, .xlsm, .xls). Árvores já cadastradas com o mesmo número e AUTEX serão atualizadas sem apagar o GPS. Se houver colunas Latitude e Longitude, as posições também serão importadas.
      </p>
      <Button asChild variant="outline"><a href={modelo.url} download="modelo-base.xlsx"><Download /> Baixar planilha modelo</a></Button>
      <label className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary p-8 text-center bg-card ${busy ? "opacity-50" : "cursor-pointer"}`}>
        <FileSpreadsheet className="size-10 text-primary" />
        <span className="font-semibold">Escolher arquivo</span>
        <input type="file" aria-label="Importar ficha de campo" accept=".pdf,.xlsx,.xlsm,.xls" className="hidden" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void processar(file); }} />
      </label>
      {preparado && <section className="space-y-3 border-t pt-4">
        <div className="text-sm break-all">{preparado.arquivo}</div>
        <div className="font-semibold">{preparado.arvores.length} árvores reconhecidas</div>
        {(preparado.invalidas > 0 || preparado.repetidas > 0) && <div className="text-sm text-destructive">{preparado.invalidas} linhas inválidas · {preparado.repetidas} repetições (último valor mantido)</div>}
        <Label htmlFor="autex-importacao">AUTEX para árvores sem autorização no arquivo</Label>
        <Input id="autex-importacao" value={autexPadrao} onChange={(e) => setAutexPadrao(e.target.value)} />
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{["Nº", "Espécie", "CAP", "DAP", "Altura", "Volume", "Picada"].map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{preparado.arvores.slice(0, 5).map((a) => <tr key={`${a.numero}|${a.autex}`} className="border-t"><td className="p-2">{a.numero}</td><td className="p-2">{a.nome_vulgar}</td><td className="p-2">{a.cap ?? "—"}</td><td className="p-2">{a.dap?.toFixed(2) ?? "—"}</td><td className="p-2">{a.altura ?? "—"}</td><td className="p-2">{a.volume ?? "—"}</td><td className="p-2">{a.picada ?? "—"}</td></tr>)}</tbody></table></div>
        <Button disabled={busy} onClick={confirmar}>Confirmar importação</Button>
      </section>}
      {status && <div className="rounded-lg bg-secondary p-3 text-sm">{status}</div>}
      {busy && <Button disabled className="w-full">Importando…</Button>}
    </div>
  );
}

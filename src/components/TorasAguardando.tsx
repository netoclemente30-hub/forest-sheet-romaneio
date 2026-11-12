import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QrCode, Trash2, Printer, FileSpreadsheet, FileText, Download, BadgeCheck, PrinterX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { empresaIdGravacao } from "@/lib/empresa";
import { capturarLog, gravarRegistro } from "@/lib/registro";
import { fmtM3 } from "@/lib/volume";
import { fmtComprimentoComercial } from "@/lib/medida-comercial";
import { codigoAguardando, proximoNumeroAguardando, qrAguardando, volumesAguardando, type ToraAguardando, type MedidasAguardando } from "@/lib/toras-aguardando";
import { marcarAguardandoImpressa } from "@/lib/toras-aguardando-salvar";
import { TAMANHOS_PADRAO } from "@/lib/etiqueta-pdf";
import { salvarArquivo, type ArquivoGerado } from "@/lib/arquivo";
import { excelAguardando, pdfAguardando } from "@/lib/toras-aguardando";
import { comCache } from "@/lib/offline/cache";
import { fila } from "@/lib/offline/fila";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrImage } from "@/components/QrImage";

const query = {
  queryKey: ["toras_aguardando"],
  queryFn: async (): Promise<ToraAguardando[]> => {
    const salvas = await comCache<ToraAguardando>("toras_aguardando", async () => {
      const { data, error } = await supabase.from("toras_aguardando").select("*").order("numero", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(norma);
    });
    const ids = new Set(salvas.map((t) => t.id));
    const pendentes = (await fila().listar().catch(() => [])).flatMap(({ op }) => op.tipo === "aguardando_insert" && !ids.has(String(op.dados["id"])) ? [norma(op.dados)] : []);
    return [...pendentes, ...salvas].sort((a, b) => b.numero - a.numero);
  },
};

/** Garante os campos de impressão mesmo em dados salvos antes desta versão. */
function norma(d: Record<string, unknown>): ToraAguardando {
  const b = d["etiqueta_impressa"];
  return {
    ...(d as unknown as ToraAguardando),
    d_topo1: Number(d["d_topo1"]), d_topo2: Number(d["d_topo2"]), d_pe1: Number(d["d_pe1"]), d_pe2: Number(d["d_pe2"]),
    comprimento: Number(d["comprimento"]), volume: Number(d["volume"]),
    etiqueta_impressa: b === true || b === 1 || b === "true",
    etiqueta_impressa_em: (d["etiqueta_impressa_em"] as string | null | undefined) ?? null,
  };
}

const num = (s: string) => { const n = Number(s.replace(",", ".")); return s.trim() && Number.isFinite(n) && n > 0 ? n : undefined; };
const vazio = { especie: "", nome_cientifico: "", d_topo1: "", d_topo2: "", d_pe1: "", d_pe2: "", comprimento: "" };

type Filtro = "todas" | "nao" | "sim";
const ROTULO_FILTRO: Record<Filtro, string> = { todas: "Todas", nao: "Não impressas", sim: "Impressas" };

export function TorasAguardando({ especies }: { especies: { especie: string; nome_cientifico: string | null }[] }) {
  const qc = useQueryClient();
  const lista = useQuery(query);
  const [f, setF] = useState(vazio);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<ToraAguardando | null>(null);
  const [tamanho, setTamanho] = useState(0);
  const [relatorio, setRelatorio] = useState<ArquivoGerado | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  async function gerarRelatorio(tipo: "pdf" | "xlsx") {
    try {
      let empresa = "";
      const ids = [...new Set((lista.data ?? []).map((t) => t.empresa_id))];
      if (ids.length) { const { data } = await supabase.from("empresas").select("nome").in("id", ids); empresa = (data ?? []).map((e) => e.nome).join(", "); }
      setRelatorio(await (tipo === "pdf" ? pdfAguardando : excelAguardando)(lista.data ?? [], empresa));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao gerar relatório"); }
  }
  const medidas = { d_topo1: num(f.d_topo1), d_topo2: num(f.d_topo2), d_pe1: num(f.d_pe1), d_pe2: num(f.d_pe2), comprimento: num(f.comprimento) };
  const vol = volumesAguardando(medidas);
  const nomes = useMemo(() => [...new Map(especies.filter((e) => e.especie).map((e) => [e.especie, e])).values()], [especies]);
  const itens = lista.data ?? [];
  const totFis = itens.reduce((s, t) => s + t.volume, 0);
  const totCom = itens.reduce((s, t) => s + (volumesAguardando(t)?.comercial?.volume ?? 0), 0);
  const naoImpressas = itens.filter((t) => !t.etiqueta_impressa).length;
  const impressas = itens.length - naoImpressas;
  const vistas = filtro === "todas" ? itens : itens.filter((t) => filtro === "sim" ? t.etiqueta_impressa : !t.etiqueta_impressa);

  async function salvar() {
    if (!f.especie.trim()) { toast.error("Informe o nome da madeira"); return; }
    if (!vol) { toast.error("Preencha os 4 diâmetros e o comprimento"); return; }
    setBusy(true);
    try {
      if (!navigator.onLine) {
        const atuais = await qc.fetchQuery({ ...query, staleTime: 0 });
        const t = { id: crypto.randomUUID(), ...empresaIdGravacao(), numero: proximoNumeroAguardando(atuais), especie: f.especie.trim(), nome_cientifico: f.nome_cientifico.trim() || null, ...(medidas as MedidasAguardando), volume: Number(vol.fisico.toFixed(4)), created_at: new Date().toISOString(), etiqueta_impressa: false, etiqueta_impressa_em: null };
        const log = await capturarLog("Tora não identificada medida", `${codigoAguardando(t.numero)} · ${t.especie} · físico ${fmtM3(t.volume)} m³ · comercial ${fmtM3(vol.comercial?.volume ?? 0)} m³`);
        await fila().enfileirar({ tipo: "aguardando_insert", dados: t, log });
        toast.success(`${codigoAguardando(t.numero)} salva sem internet — será enviada quando conectar`);
        setF((x) => ({ ...vazio, especie: x.especie, nome_cientifico: x.nome_cientifico }));
        await qc.invalidateQueries({ queryKey: query.queryKey });
        setQr(t as unknown as ToraAguardando);
        return;
      }
      let salvo: ToraAguardando | null = null;
      for (let tent = 0; tent < 3 && !salvo; tent++) {
        const atuais = (await qc.fetchQuery({ ...query, staleTime: 0 }));
        const numero = proximoNumeroAguardando(atuais);
        const { data, error } = await supabase.from("toras_aguardando").insert({ id: crypto.randomUUID(), ...empresaIdGravacao(), numero, especie: f.especie.trim(), nome_cientifico: f.nome_cientifico.trim() || null, ...(medidas as MedidasAguardando), volume: Number(vol.fisico.toFixed(4)) }).select().single();
        if (error && error.code !== "23505") throw error;
        if (data) salvo = norma(data as Record<string, unknown>);
      }
      if (!salvo) throw new Error("Não foi possível reservar o número. Tente de novo.");
      await gravarRegistro(await capturarLog("Tora não identificada medida", `${codigoAguardando(salvo.numero)} · ${salvo.especie} · físico ${fmtM3(salvo.volume)} m³ · comercial ${fmtM3(vol.comercial?.volume ?? 0)} m³`));
      toast.success(`${codigoAguardando(salvo.numero)} salva`);
      setF((x) => ({ ...vazio, especie: x.especie, nome_cientifico: x.nome_cientifico }));
      await qc.invalidateQueries({ queryKey: query.queryKey });
      setQr(salvo);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setBusy(false); }
  }

  async function excluir(t: ToraAguardando) {
    if (!confirm(`Excluir ${codigoAguardando(t.numero)} (${t.especie})?`)) return;
    if (!navigator.onLine) { toast.error("Precisa de internet para excluir"); return; }
    const { error } = await supabase.from("toras_aguardando").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    await gravarRegistro(await capturarLog("Tora não identificada excluída", `${codigoAguardando(t.numero)} · ${t.especie}`));
    await qc.invalidateQueries({ queryKey: query.queryKey });
  }

  /** Marca a impressão (ou volta a marcar como não impressa); offline vai junto com a fila. */
  async function marcar(ts: ToraAguardando[], imprimiu: boolean) {
    if (!ts.length) return;
    try {
      const { offline } = await marcarAguardandoImpressa(ts, imprimiu);
      if (offline) toast.success(`${offline} tora${offline > 1 ? "s" : ""} marcada${offline > 1 ? "s" : ""} sem internet — será enviada quando conectar`);
      await qc.invalidateQueries({ queryKey: query.queryKey });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível marcar a impressão"); }
  }

  async function etiquetas(ts: ToraAguardando[]) {
    try {
      const { gerarEtiquetasAguardandoPdf } = await import("@/lib/etiqueta-pdf");
      const t = TAMANHOS_PADRAO[tamanho] ?? TAMANHOS_PADRAO[0]!;
      const doc = await gerarEtiquetasAguardandoPdf(ts, t);
      await salvarArquivo({ blob: doc.output("blob"), nome: ts.length === 1 ? `etiqueta_${codigoAguardando(ts[0]!.numero)}.pdf` : `etiquetas_nao_identificadas.pdf` });
      await marcar(ts, true);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao gerar etiqueta"); }
  }

  const campo = (k: keyof typeof vazio, label: string, decimal = true) => (
    <label className="text-xs font-semibold">{label}
      <Input className="h-12" inputMode={decimal ? "decimal" : "text"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} aria-label={label} />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-xl p-3 space-y-3">
        <p className="text-sm text-muted-foreground">Meça a tora e informe só o nome da madeira — sem árvore e sem seção. Ela recebe um código NI próprio e não entra no estoque nem no saldo.</p>
        <label className="text-xs font-semibold block">Nome da madeira
          <Input className="h-12" list="madeiras-aguardando" value={f.especie} aria-label="Nome da madeira" onChange={(e) => { const v = e.target.value; const e2 = nomes.find((n) => n.especie === v); setF({ ...f, especie: v, nome_cientifico: e2?.nome_cientifico ?? f.nome_cientifico }); }} />
        </label>
        <datalist id="madeiras-aguardando">{nomes.map((n) => <option key={n.especie} value={n.especie} />)}</datalist>
        {campo("nome_cientifico", "Nome científico (opcional)", false)}
        <div className="grid grid-cols-2 gap-2">
          {campo("d_topo1", "DF1 topo (cm)")}{campo("d_topo2", "DF2 topo (cm)")}
          {campo("d_pe1", "DF3 pé (cm)")}{campo("d_pe2", "DF4 pé (cm)")}
        </div>
        {campo("comprimento", "Comprimento (m)")}
        {vol && <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-muted p-2"><div className="text-xs">Físico</div><b>{fmtM3(vol.fisico)} m³</b><div className="text-xs">{f.comprimento} m</div></div>
          <div className="rounded-lg bg-muted p-2"><div className="text-xs">Comercial</div><b>{fmtM3(vol.comercial?.volume ?? 0)} m³</b>{vol.comercial && <div className="text-xs">{vol.comercial.d1}×{vol.comercial.d2} cm · {fmtComprimentoComercial(vol.comercial.comprimento)} m</div>}</div>
        </div>}
        <Button className="w-full h-12" disabled={busy} onClick={salvar}>{busy ? "Salvando…" : "Salvar e gerar QR"}</Button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-card border p-2"><b className="text-xl">{itens.length}</b><div className="text-xs">toras</div><div className="text-xs text-warning font-semibold">{naoImpressas} não impressa{naoImpressas === 1 ? "" : "s"}</div></div>
        <div className="rounded-lg bg-card border p-2"><b>{fmtM3(totFis)}</b><div className="text-xs">m³ físico</div></div>
        <div className="rounded-lg bg-card border p-2"><b>{fmtM3(totCom)}</b><div className="text-xs">m³ comercial</div></div>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Filtrar por etiqueta impressa">
        {(Object.keys(ROTULO_FILTRO) as Filtro[]).map((k) => (
          <Button key={k} role="tab" aria-selected={filtro === k} size="sm" variant={filtro === k ? "default" : "ghost"} className="h-auto py-2 whitespace-normal" onClick={() => setFiltro(k)}>
            {ROTULO_FILTRO[k]} ({k === "todas" ? itens.length : k === "nao" ? naoImpressas : impressas})
          </Button>
        ))}
      </div>

      <div className="flex gap-2">
        <select className="h-10 rounded-md border bg-background px-2 text-sm" aria-label="Tamanho da etiqueta" value={tamanho} onChange={(e) => setTamanho(Number(e.target.value))}>
          {TAMANHOS_PADRAO.map((t, i) => <option key={i} value={i}>{t.largura}×{t.altura} mm</option>)}
        </select>
        <Button variant="outline" className="flex-1" disabled={!vistas.length} onClick={() => etiquetas(vistas)}><Printer /> Etiquetas {ROTULO_FILTRO[filtro].toLowerCase()}</Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={!itens.length} onClick={() => gerarRelatorio("pdf")}><FileText /> Relatório PDF</Button>
        <Button variant="secondary" disabled={!itens.length} onClick={() => gerarRelatorio("xlsx")}><FileSpreadsheet /> Relatório Excel</Button>
      </div>
      <Dialog open={!!relatorio} onOpenChange={(o) => !o && setRelatorio(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Relatório pronto</DialogTitle></DialogHeader>
          <p className="text-sm break-all">{relatorio?.nome}</p>
          <Button className="w-full h-12" onClick={() => relatorio && salvarArquivo(relatorio)}><Download /> Salvar arquivo</Button>
        </DialogContent>
      </Dialog>
      {lista.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar a lista. Confira a internet.</p>}
      <div className="bg-card border rounded-xl divide-y">
        {!itens.length && !lista.isPending && <p className="p-3 text-sm text-muted-foreground">Nenhuma tora aguardando identificação.</p>}
        {!!itens.length && !vistas.length && !lista.isPending && <p className="p-3 text-sm text-muted-foreground">Nenhuma tora {filtro === "nao" ? "sem etiqueta impressa" : "com etiqueta impressa"}.</p>}
        {vistas.map((t) => { const c = volumesAguardando(t)?.comercial; return (
          <div key={t.id} className="p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{codigoAguardando(t.numero)} · {t.especie}</div>
                {t.nome_cientifico && <div className="text-xs italic text-muted-foreground">{t.nome_cientifico}</div>}
                <div className="text-xs text-muted-foreground">{t.d_topo1}×{t.d_topo2} / {t.d_pe1}×{t.d_pe2} cm · {t.comprimento} m</div>
                <div className="text-xs">Físico {fmtM3(t.volume)} m³ · Comercial {fmtM3(c?.volume ?? 0)} m³{c && ` (${c.d1}×${c.d2} · ${fmtComprimentoComercial(c.comprimento)} m)`}</div>
                {t.etiqueta_impressa && t.etiqueta_impressa_em && <div className="text-xs text-success">Etiqueta impressa em {new Date(t.etiqueta_impressa_em).toLocaleString("pt-BR")}</div>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  aria-pressed={t.etiqueta_impressa}
                  onClick={() => marcar([t], !t.etiqueta_impressa)}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${t.etiqueta_impressa ? "bg-success/15 text-success" : "border border-dashed text-muted-foreground"}`}
                >
                  {t.etiqueta_impressa ? <><BadgeCheck className="h-3.5 w-3.5" /> Impressa</> : <><PrinterX className="h-3.5 w-3.5" /> Não impressa</>}
                </button>
                <div className="flex gap-1">
                  <Button size="icon" variant="outline" className="h-8 w-8" aria-label={`QR ${codigoAguardando(t.numero)}`} onClick={() => setQr(t)}><QrCode className="h-4 w-4" /></Button>
                  <Button size="icon" variant="outline" className="h-8 w-8 text-destructive" aria-label={`Excluir ${codigoAguardando(t.numero)}`} onClick={() => excluir(t)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          </div>); })}
      </div>

      <Dialog open={!!qr} onOpenChange={(o) => !o && setQr(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{qr && codigoAguardando(qr.numero)} · {qr?.especie}</DialogTitle></DialogHeader>
          {qr && <div className="flex flex-col items-center gap-3">
            <QrImage value={qrAguardando(qr)} size={200} />
            <div className="text-sm text-center">Físico {fmtM3(qr.volume)} m³ · Comercial {fmtM3(volumesAguardando(qr)?.comercial?.volume ?? 0)} m³</div>
            <Button className="w-full h-12" onClick={() => etiquetas([qr])}><Printer /> Baixar etiqueta (PDF)</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

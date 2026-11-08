import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Arvore, Tora } from "@/lib/data";
import { volumeTora, fmtM3 } from "@/lib/volume";
import { getEmpresaAtiva } from "@/lib/empresa";
import { fila } from "@/lib/offline/fila";
import { estaOnline } from "@/lib/offline/sync";
import { capturarLog, gravarRegistro } from "@/lib/registro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutexPicker } from "./AutexPicker";
import type { LinhaSaldo } from "@/lib/saldo";
import { useAuth } from "@/hooks/useAuth";
import { avisoDuplicidade, toraDuplicada, type IdentidadeTora } from "@/lib/tora-duplicidade";
import { registrarOperacao } from "@/lib/registro-operacao";

const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

export function ToraForm({ toras, arvores, onSaved, saldo = [] }: { toras: Tora[]; arvores: Arvore[]; onSaved: (plaqueta: number) => void; saldo?: LinhaSaldo[] }) {
  const qc = useQueryClient();
  const { empresaId } = useAuth();
  const empresa = getEmpresaAtiva() ?? empresaId;
  const torasEmpresa = useMemo(() => toras.filter((t) => t.empresa_id === empresa), [toras, empresa]);
  const proxima = useMemo(() => toras.reduce((m, t) => Math.max(m, t.plaqueta), 0) + 1, [toras]);
  const [f, setF] = useState({ plaqueta: String(proxima), arvore: "", secao: "A", d_topo1: "", d_topo2: "", d_pe1: "", d_pe2: "", comprimento: "" });
  const [busy, setBusy] = useState(false);
  const [autex, setAutex] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const candidatas = useMemo(() => f.arvore ? arvores.filter((a) => a.numero === Number(f.arvore)) : [], [arvores, f.arvore]);
  const arv = candidatas.length === 1 ? candidatas[0] : candidatas.find((a) => a.autex === autex);
  const especie = arv?.nome_vulgar;
  const escolherArvore = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(k)(e);
    const c = arvores.filter((a) => a.numero === Number(e.target.value));
    const u = c.length === 1 ? c[0] : undefined; if (u?.autex) setAutex(u.autex);
  };
  // Tora vinda do saldo (só volume, sem medidas) com a mesma árvore e secção: medir completa ela.
  const secAtual = f.secao.trim().toUpperCase();
  const doSaldoTodas = useMemo(() => f.arvore && secAtual ? torasEmpresa.filter((t) => t.arvore === Number(f.arvore) && (t.secao ?? "").trim().toUpperCase() === secAtual && !t.carregada && t.d_topo1 === null && t.comprimento === null) : [], [torasEmpresa, f.arvore, secAtual]);
  const doSaldo = doSaldoTodas.length === 1 ? doSaldoTodas[0] : doSaldoTodas.find((t) => (t.autex ?? "") === autex);
  // Linha do arquivo de saldo (ainda não cadastrada) com a mesma árvore e secção.
  const linhasSaldo = useMemo(() => !doSaldoTodas.length && f.arvore && secAtual ? saldo.filter((l) => l.arvore === Number(f.arvore) && l.secao === secAtual) : [], [saldo, doSaldoTodas.length, f.arvore, secAtual]);
  const linhaSaldo = linhasSaldo.length === 1 ? linhasSaldo[0] : linhasSaldo.find((l) => l.autex === autex);
  const autexEfetiva = doSaldo?.autex ?? linhaSaldo?.autex ?? (autex || arv?.autex || null);
  const identidade = { arvore: Number(f.arvore), secao: secAtual, autex: autexEfetiva, empresa_id: empresa };
  const duplicada = toraDuplicada(torasEmpresa, identidade, doSaldo?.plaqueta);
  const medidas = { d_topo1: num(f.d_topo1), d_topo2: num(f.d_topo2), d_pe1: num(f.d_pe1), d_pe2: num(f.d_pe2), comprimento: num(f.comprimento) };
  const vol = volumeTora(medidas);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!empresa) { toast.error("Aguarde carregar a empresa antes de salvar"); return; }
    if (duplicada) { toast.error(avisoDuplicidade(duplicada)); return; }
    if (doSaldo) { await medirSaldo(doSaldo); return; }
    if (doSaldoTodas.length > 1) { toast.error(`Árvore ${f.arvore} secção ${secAtual} está no saldo em mais de uma AUTEX — escolha qual`); return; }
    if (linhasSaldo.length > 1 && !linhaSaldo) { toast.error(`Árvore ${f.arvore} secção ${secAtual} está no saldo em mais de uma AUTEX — escolha qual`); return; }
    const plaqueta = Number(f.plaqueta);
    if (candidatas.length > 1 && !arv) { toast.error(`Árvore ${f.arvore} existe em mais de uma AUTEX — escolha qual`); return; }
    if (torasEmpresa.some((t) => t.plaqueta === plaqueta)) { toast.error(`Plaqueta ${plaqueta} já existe`); return; }
    const sec = f.secao.trim().toUpperCase();
    const dados = {
      plaqueta, arvore: Number(f.arvore), especie: linhaSaldo?.especie || especie || "Não cadastrada", nome_cientifico: linhaSaldo?.nome_cientifico || arv?.nome_cientifico || null, autex: autexEfetiva, carregada: false, secao: sec || null, ...medidas, volume: vol, empresa_id: empresa,
    };
    setBusy(true);
    try {
      const pendentes: IdentidadeTora[] = (await fila().listar()).flatMap(({ op }) => {
        if (op.tipo !== "tora_insert") return [];
        return [{ arvore: Number(op.dados["arvore"]), secao: String(op.dados["secao"] ?? ""), autex: String(op.dados["autex"] ?? ""), empresa_id: typeof op.dados["empresa_id"] === "string" ? op.dados["empresa_id"] : empresa, plaqueta: Number(op.dados["plaqueta"]) }];
      });
      const repetida = toraDuplicada(pendentes, identidade);
      if (repetida) { toast.error(avisoDuplicidade(repetida)); setBusy(false); return; }
      if (pendentes.some((t) => t.empresa_id === empresa && t.plaqueta === plaqueta)) { toast.error(`Plaqueta ${plaqueta} já existe nos lançamentos offline`); setBusy(false); return; }
      if (estaOnline()) {
        const { data, error } = await supabase.from("toras").select("*").eq("empresa_id", empresa).eq("arvore", dados.arvore);
        if (error) throw error;
        const atual = toraDuplicada(data ?? [], identidade);
        if (atual) { toast.error(avisoDuplicidade(atual)); setBusy(false); void qc.invalidateQueries({ queryKey: ["toras"] }); return; }
      }
    } catch (erro) {
      setBusy(false);
      toast.error(erro instanceof Error ? erro.message : "Não foi possível verificar se a tora já existe. Tente novamente.");
      return;
    }
    const log = await capturarLog("Tora lançada", `Tora ${plaqueta} · ${dados.especie} · árvore ${f.arvore} · secção ${f.secao || "–"}`);
    if (!estaOnline()) {
      await fila().enfileirar({ tipo: "tora_insert", dados, log });
      setBusy(false);
      toast.success(`Tora ${plaqueta} salva offline — será enviada quando conectar`);
    } else {
      try { await registrarOperacao("tora_insert", empresa, dados, [], log); }
      catch (error) { setBusy(false); toast.error(error instanceof Error ? error.message : "Não foi possível salvar"); return; }
      setBusy(false);
      toast.success(`Tora ${plaqueta} salva — ${fmtM3(vol)} m³`);
      await qc.invalidateQueries({ queryKey: ["toras"] });
    }
    onSaved(plaqueta);
    setF({ ...f, plaqueta: String(plaqueta + 1), secao: String.fromCharCode(f.secao.charCodeAt(0) + 1), d_topo1: "", d_topo2: "", d_pe1: "", d_pe2: "", comprimento: "" });
  }

  async function medirSaldo(t: Tora) {
    if (!estaOnline()) { toast.error("Precisa de internet para medir tora do saldo"); return; }
    setBusy(true);
    const dif = vol - Number(t.volume);
    const log = await capturarLog("Tora do saldo medida", `Tora ${t.plaqueta} · ${t.especie} · árvore ${t.arvore}-${t.secao} · saldo ${fmtM3(Number(t.volume))} m³ · medido ${fmtM3(vol)} m³ (${dif >= 0 ? "+" : ""}${fmtM3(dif)})`);
    try { await registrarOperacao("tora_update", t.empresa_id, { ...medidas, volume: vol }, [t.plaqueta], log); }
    catch (error) { setBusy(false); toast.error(error instanceof Error ? error.message : "Não foi possível medir"); return; }
    setBusy(false);
    toast.success(`Tora ${t.plaqueta} medida — saldo ${fmtM3(Number(t.volume))} m³ · medido ${fmtM3(vol)} m³`);
    await qc.invalidateQueries({ queryKey: ["toras"] });
    onSaved(t.plaqueta);
    setF({ ...f, arvore: "", secao: "A", d_topo1: "", d_topo2: "", d_pe1: "", d_pe2: "", comprimento: "" });
  }

  const field = (k: keyof typeof f, label: string, mode: "numeric" | "decimal" | "text" = "numeric") => (
    <div className="space-y-1">
      <Label htmlFor={k} className="text-xs">{label}</Label>
      <Input id={k} inputMode={mode} value={f[k]} onChange={k === "arvore" ? escolherArvore(k) : set(k)} required={k !== "secao"} className="h-11 text-lg" />
    </div>
  );

  return (
    <form onSubmit={salvar} className="space-y-3">
      <AutexPicker value={autex} onChange={setAutex} />
      <div className="grid grid-cols-3 gap-2">
        {field("plaqueta", "Plaqueta azul")}
        {field("arvore", "Nº árvore")}
        {field("secao", "Secção", "text")}
      </div>
      {duplicada && <div role="alert" className="rounded-md bg-destructive text-destructive-foreground px-3 py-2 text-sm font-semibold">{avisoDuplicidade(duplicada)}. Esta tora já foi lançada.</div>}
      {candidatas.length > 1 && (
        <div className="rounded-md border border-primary p-2 space-y-1">
          <div className="text-sm font-semibold">Árvore {f.arvore} existe em {candidatas.length} AUTEX. De qual é?</div>
          <div className="flex flex-wrap gap-2">
            {candidatas.map((a) => (
              <Button key={a.id} type="button" size="sm" variant={arv?.id === a.id ? "default" : "outline"} onClick={() => setAutex(a.autex)}>
                {a.autex || "Sem AUTEX"} · {a.nome_vulgar}
              </Button>
            ))}
          </div>
        </div>
      )}
      {doSaldoTodas.length > 1 && !doSaldo && (
        <div className="rounded-md border border-primary p-2 space-y-1">
          <div className="text-sm font-semibold">Árvore {f.arvore}-{secAtual} está no saldo em {doSaldoTodas.length} AUTEX. De qual é?</div>
          <div className="flex flex-wrap gap-2">{doSaldoTodas.map((t) => <Button key={t.plaqueta} type="button" size="sm" variant="outline" onClick={() => setAutex(t.autex ?? "")}>{t.autex || "Sem AUTEX"} · {t.especie}</Button>)}</div>
        </div>
      )}
      {linhasSaldo.length > 1 && !linhaSaldo && (
        <div className="rounded-md border border-primary p-2 space-y-1">
          <div className="text-sm font-semibold">Árvore {f.arvore}-{secAtual} está no saldo em {linhasSaldo.length} AUTEX. De qual é?</div>
          <div className="flex flex-wrap gap-2">{linhasSaldo.map((l, i) => <Button key={i} type="button" size="sm" variant="outline" onClick={() => setAutex(l.autex)}>{l.autex} · {l.especie}</Button>)}</div>
        </div>
      )}
      {linhaSaldo && (
        <div className="rounded-md border-2 border-primary bg-secondary p-3 text-sm space-y-1">
          <div className="font-semibold">No saldo · plaqueta nova {f.plaqueta}</div>
          <div>{linhaSaldo.especie}{linhaSaldo.nome_cientifico && <i> · {linhaSaldo.nome_cientifico}</i>}</div>
          <div className="text-xs">{linhaSaldo.autex}</div>
          <div className="flex justify-between pt-1"><span>Saldo: <b>{fmtM3(linhaSaldo.volume ?? 0)} m³</b></span><span>Medido: <b>{fmtM3(vol)} m³</b></span></div>
          {vol > 0 && <div className={vol - (linhaSaldo.volume ?? 0) >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>Diferença: {vol - (linhaSaldo.volume ?? 0) >= 0 ? "+" : ""}{fmtM3(vol - (linhaSaldo.volume ?? 0))} m³</div>}
        </div>
      )}
      {f.arvore && secAtual && saldo.length > 0 && !doSaldoTodas.length && !linhasSaldo.length && <div className="rounded-md bg-destructive text-destructive-foreground px-3 py-2 text-sm font-semibold">Árvore {f.arvore}-{secAtual} não está no saldo</div>}
      {doSaldo && (
        <div className="rounded-md border-2 border-primary bg-secondary p-3 text-sm space-y-1">
          <div className="font-semibold">Tora do saldo · plaqueta {doSaldo.plaqueta}</div>
          <div>{doSaldo.especie}{doSaldo.nome_cientifico && <i> · {doSaldo.nome_cientifico}</i>}</div>
          <div className="text-xs">AUTEX {doSaldo.autex ?? "—"}</div>
          <div className="flex justify-between pt-1"><span>Saldo: <b>{fmtM3(Number(doSaldo.volume))} m³</b></span><span>Medido: <b>{fmtM3(vol)} m³</b></span></div>
          {vol > 0 && <div className={vol - Number(doSaldo.volume) >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>Diferença: {vol - Number(doSaldo.volume) >= 0 ? "+" : ""}{fmtM3(vol - Number(doSaldo.volume))} m³</div>}
        </div>
      )}
      <div className={`text-sm rounded-md px-3 py-2 ${especie ? "bg-secondary" : "bg-muted text-muted-foreground"}`}>
        Espécie: <b>{f.arvore ? doSaldo?.especie ?? linhaSaldo?.especie ?? especie ?? "Não cadastrada na BASE" : "—"}</b>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {field("d_topo1", "D. Topo 1 (cm)")}
        {field("d_topo2", "D. Topo 2 (cm)")}
        {field("d_pe1", "D. Pé 1 (cm)")}
        {field("d_pe2", "D. Pé 2 (cm)")}
      </div>
      {field("comprimento", "Comprimento (m)", "decimal")}
      <div className="flex items-center justify-between rounded-lg bg-forest text-primary-foreground px-4 py-3">
        <span className="text-sm opacity-80">Volume</span>
        <span className="font-display text-2xl font-bold">{fmtM3(vol)} m³</span>
      </div>
      <Button type="submit" size="lg" className="w-full h-12" disabled={busy}>{doSaldo ? `Salvar medidas da tora ${doSaldo.plaqueta}` : "Salvar tora"}</Button>
    </form>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { empresaIdGravacao, getEmpresaAtiva } from "@/lib/empresa";
import { capturarLog, gravarRegistro } from "@/lib/registro";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { torasQuery, arvoresQuery, type Tora } from "@/lib/data";
import { ToraForm } from "@/components/ToraForm";
import { ToraEditor, excluirTora } from "@/components/ToraEditor";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { conferirSaldo, lerSaldo, novasTorasDoSaldo, type LinhaSaldo } from "@/lib/saldo";
import { fmtM3 } from "@/lib/volume";
import { Button } from "@/components/ui/button";
import { Printer, Upload, Ruler, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/saldo")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Conferir saldo — Manejo Florestal" },
      { name: "description", content: "Confira o saldo da serraria com a planilha e imprima as plaquetas." },
      { property: "og:title", content: "Conferir saldo — Manejo Florestal" },
      { property: "og:description", content: "Confira o saldo da serraria com a planilha e imprima as plaquetas." },
    ],
  }),
  component: Saldo,
});

function Saldo() {
  const toras = useQuery(torasQuery);
  const [linhas, setLinhasState] = useState<LinhaSaldo[]>([]);
  // Saldo compartilhado por empresa na nuvem; cópia local para uso offline.
  useEffect(() => {
    try { setLinhasState(JSON.parse(localStorage.getItem("saldo-linhas") ?? "[]")); } catch { /* sem saldo salvo */ }
    if (!navigator.onLine) return;
    (async () => {
      const emp = getEmpresaAtiva() ?? ((await supabase.rpc("minha_empresa")).data as string | null);
      if (!emp) return;
      const { data } = await supabase.from("saldos").select("linhas").eq("empresa_id", emp).maybeSingle();
      if (data?.linhas) { const l = data.linhas as unknown as LinhaSaldo[]; setLinhasState(l); try { localStorage.setItem("saldo-linhas", JSON.stringify(l)); } catch { /* cheio */ } }
    })();
  }, []);
  const setLinhas = async (l: LinhaSaldo[]) => {
    setLinhasState(l);
    try { localStorage.setItem("saldo-linhas", JSON.stringify(l)); } catch { /* cheio */ }
    if (!navigator.onLine) return;
    const emp = getEmpresaAtiva() ?? ((await supabase.rpc("minha_empresa")).data as string | null);
    if (!emp) return;
    const { error } = await supabase.from("saldos").upsert({ empresa_id: emp, linhas: l as unknown as never, atualizado_em: new Date().toISOString() });
    if (error) toast.error("Saldo não foi compartilhado: " + error.message);
  };
  const res = useMemo(() => conferirSaldo(linhas, toras.data ?? []), [linhas, toras.data]);
  const ok = res.filter((r) => r.tora);
  const fora = res.length - ok.length;
  const qc = useQueryClient();
  const arvores = useQuery(arvoresQuery);
  const [medir, setMedir] = useState(false);
  const [medidas, setMedidas] = useState<number[]>([]);
  // Toras do saldo = cadastradas só com volume; quando medidas ganham diâmetros.
  const pendentes = (toras.data ?? []).filter((t) => !t.carregada && t.d_topo1 === null && t.comprimento === null);
  const [inicio, setInicio] = useState("");
  const [busy, setBusy] = useState(false);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"todos" | "estoque" | "fora">("todos");
  const [edit, setEdit] = useState<Tora | null>(null);
  const [sel, setSel] = useState<number[]>([]);

  async function cadastrar() {
    const ini = Number(inicio);
    if (!Number.isSafeInteger(ini) || ini <= 0) { toast.error("Digite a plaqueta inicial"); return; }
    if (!navigator.onLine) { toast.error("Precisa de internet para cadastrar o saldo"); return; }
    const novas = novasTorasDoSaldo(res.filter((r) => !r.tora).map((r) => r.linha), ini, new Set((toras.data ?? []).map((t) => t.plaqueta)));
    if (!confirm(`Cadastrar ${novas.length} toras no estoque, plaquetas ${novas[0]?.plaqueta} a ${novas.at(-1)?.plaqueta}?`)) return;
    setBusy(true);
    try {
      const emp = empresaIdGravacao();
      const autexes = [...new Set(novas.map((t) => t.autex).filter((a): a is string => !!a))];
      if (autexes.length) { const { error } = await supabase.from("autex").upsert(autexes.map((numero) => ({ numero, ...emp })), { onConflict: "empresa_id,numero", ignoreDuplicates: true }); if (error) throw error; }
      for (let i = 0; i < novas.length; i += 500) {
        const { error } = await supabase.from("toras").insert(novas.slice(i, i + 500).map((t) => ({ ...t, ...emp })));
        if (error) throw error;
      }
      await gravarRegistro(await capturarLog("Saldo cadastrado", `${novas.length} toras · plaquetas ${novas[0]?.plaqueta}–${novas.at(-1)?.plaqueta}`));
      toast.success(`${novas.length} toras cadastradas`);
      await qc.invalidateQueries({ queryKey: ["toras"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao cadastrar"); }
    finally { setBusy(false); }
  }

  async function abrir(f: File) {
    try {
      const XLSX = await import("xlsx");
      const wb = /\.csv$/i.test(f.name) ? XLSX.read(await f.text(), { type: "string", FS: ";" }) : XLSX.read(await f.arrayBuffer());
      const l = lerSaldo(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0] ?? ""]!, { header: 1, raw: false }));
      await setLinhas(l);
      const autexes = [...new Set(l.map((x) => x.autex).filter(Boolean))];
      if (autexes.length && navigator.onLine) await supabase.from("autex").upsert(autexes.map((numero) => ({ numero, ...empresaIdGravacao() })), { onConflict: "empresa_id,numero", ignoreDuplicates: true });
      toast.success(`${l.length} linhas lidas`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível ler a planilha"); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold uppercase">Conferir saldo</h1>
      <div className="bg-card border rounded-xl p-3 space-y-2">
        <div className="flex justify-between text-sm"><span>Toras do saldo a medir</span><b>{pendentes.length + fora}</b></div>
        {!linhas.length && !pendentes.length && <div className="text-xs text-muted-foreground">Escolha primeiro a planilha de saldo abaixo.</div>}
        {medidas.length > 0 && <div className="text-xs text-muted-foreground">{medidas.length} medidas agora</div>}
        <Button className="w-full h-12" disabled={!pendentes.length && !linhas.length} onClick={() => setMedir(true)}><Ruler /> Medir tora do saldo</Button>
        {medidas.length > 0 && <Button asChild variant="secondary" className="w-full"><Link to="/etiquetas" search={{ p: medidas.join(",") }}><Printer /> Imprimir as {medidas.length} medidas agora</Link></Button>}
      </div>
      <Sheet open={medir} onOpenChange={setMedir}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader><SheetTitle className="font-display text-2xl uppercase">Medir tora do saldo</SheetTitle></SheetHeader>
          <div className="p-4 pt-0 space-y-2">
            <p className="text-xs text-muted-foreground">Digite o nº da árvore e a secção: AUTEX, espécie e nome científico vêm do saldo.</p>
            <ToraForm toras={toras.data ?? []} arvores={arvores.data ?? []} saldo={linhas} onSaved={(p) => setMedidas((m) => m.includes(p) ? m : [...m, p])} />
          </div>
        </SheetContent>
      </Sheet>
      <p className="text-sm text-muted-foreground">Envie o Excel com AUTEX, nome científico, espécie, árvore, secção e volume. Cada linha é procurada nas toras pelo AUTEX + árvore + secção.</p>
      <label className="block">
        <Button asChild variant="outline" className="w-full"><span><Upload /> Escolher planilha de saldo</span></Button>
        <input type="file" accept=".xlsx,.xlsm,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && abrir(e.target.files[0])} />
      </label>
      {res.length > 0 && <>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-forest text-primary-foreground p-3"><b className="text-2xl">{ok.length}</b><div className="text-xs">em estoque · {fmtM3(ok.reduce((n, r) => n + Number(r.tora!.volume), 0))} m³</div></div>
          <div className="rounded-lg bg-destructive text-destructive-foreground p-3"><b className="text-2xl">{fora}</b><div className="text-xs">fora de estoque</div></div>
        </div>
        {fora > 0 && <div className="bg-card border rounded-xl p-3 space-y-2">
          <div className="text-sm">Cadastrar as {fora} toras fora de estoque, só com o volume do saldo, com plaquetas em sequência:</div>
          <div className="flex gap-2">
            <Input type="number" inputMode="numeric" placeholder="Plaqueta inicial" aria-label="Plaqueta inicial" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            <Button disabled={busy || !inicio} onClick={cadastrar}>{busy ? "Cadastrando…" : "Cadastrar no estoque"}</Button>
          </div>
        </div>}
        {sel.length > 0
          ? <div className="flex gap-2"><Button asChild className="flex-1"><Link to="/etiquetas" search={{ p: sel.join(",") }}><Printer /> Imprimir selecionadas ({sel.length})</Link></Button><Button variant="outline" onClick={() => setSel([])}>Limpar</Button></div>
          : <Button asChild className="w-full" disabled={!ok.length}><Link to="/etiquetas" search={{ p: ok.map((r) => r.tora!.plaqueta).join(",") }}><Printer /> Imprimir todas ({ok.length})</Link></Button>}
        <div className="text-xs text-muted-foreground">Marque as toras na lista para imprimir só as escolhidas.</div>
        <div className="grid grid-cols-3 gap-2">
          {([["todos", `Todas (${res.length})`], ["estoque", `No estoque (${ok.length})`], ["fora", `Fora (${fora})`]] as const).map(([k, l]) => (
            <Button key={k} size="sm" variant={status === k ? "default" : "outline"} onClick={() => setStatus(k)}>{l}</Button>
          ))}
        </div>
        <Sheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
          <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader><SheetTitle className="font-display text-2xl uppercase">Plaqueta {edit?.plaqueta}</SheetTitle></SheetHeader>
            {edit && <div className="p-4 pt-0"><ToraEditor tora={edit} toras={toras.data ?? []} onDone={() => setEdit(null)} /></div>}
          </SheetContent>
        </Sheet>
        <Input placeholder="Filtrar por nome, científico, árvore ou AUTEX" aria-label="Filtrar saldo" value={busca} onChange={(e) => setBusca(e.target.value)} className="h-12" />
        <div className="bg-card border rounded-xl divide-y">
          {res.filter((r) => status === "todos" || (status === "estoque" ? !!r.tora : !r.tora)).filter((r) => { const b = busca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); if (!b) return true; return [r.linha.especie, r.linha.nome_cientifico, r.linha.autex, r.linha.secao, r.linha.arvore, r.tora?.plaqueta].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(b); }).map((r, i) => (
            <div key={i} className="flex items-center gap-2 p-3">
              {r.tora ? <input type="checkbox" className="h-5 w-5 shrink-0 accent-primary" aria-label={`Selecionar plaqueta ${r.tora.plaqueta}`} checked={sel.includes(r.tora.plaqueta)} onChange={() => { const p = r.tora!.plaqueta; setSel((s) => s.includes(p) ? s.filter((x) => x !== p) : [...s, p]); }} /> : <span className="w-5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="font-semibold leading-snug">{r.linha.especie || "Sem nome"}</div>
                {r.linha.nome_cientifico && <div className="text-xs italic text-muted-foreground">{r.linha.nome_cientifico}</div>}
                <div className="text-xs text-muted-foreground">{r.tora ? `Plaqueta ${r.tora.plaqueta} · ` : ""}Árv. {r.linha.arvore} · Sec. {r.linha.secao || "–"} · AUTEX {r.linha.autex || "—"}</div>
                <div className="text-xs text-muted-foreground">{fmtM3(Number(r.tora?.volume ?? r.linha.volume ?? 0))} m³{!r.tora && <span className="font-semibold text-destructive"> · fora de estoque</span>}</div>
              </div>
              {r.tora && <div className="flex shrink-0 items-center gap-1">
                <Button size="icon" variant="outline" className="h-8 w-8" aria-label={`Editar plaqueta ${r.tora.plaqueta}`} onClick={() => setEdit(r.tora!)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" className="h-8 w-8 text-destructive" aria-label={`Excluir plaqueta ${r.tora.plaqueta}`} onClick={async () => { if (await excluirTora(r.tora!)) await qc.invalidateQueries({ queryKey: ["toras"] }); }}><Trash2 className="h-4 w-4" /></Button>
              </div>}
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}

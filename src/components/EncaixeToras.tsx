import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CAMPOS_ENCAIXE, encaixarToras, nomesCientificosEncaixe, volumeEncaixe, type MedidasEncaixe } from "@/lib/encaixe";
import type { LinhaSaldo } from "@/lib/saldo";
import { fmtM3 } from "@/lib/volume";
import { RotateCcw } from "lucide-react";
import { Check, Printer } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tora } from "@/lib/data";
import { salvarEncaixe } from "@/lib/encaixe-salvar";
import { menorPlaquetaLivre } from "@/lib/encaixe";
import { fila, type ItemFila } from "@/lib/offline/fila";
import { estaOnline } from "@/lib/offline/sync";
import { capturarLog, gravarRegistro } from "@/lib/registro";
import { registrarOperacao } from "@/lib/registro-operacao";

const vazias: MedidasEncaixe = { d_topo1: "", d_topo2: "", d_pe1: "", d_pe2: "", comprimento: "" };
const rotulos = { d_topo1: "D. topo 1 (cm)", d_topo2: "D. topo 2 (cm)", d_pe1: "D. pé 1 (cm)", d_pe2: "D. pé 2 (cm)", comprimento: "Comprimento (m)" };

export function EncaixeToras({ linhas, toras, itens, empresa }: { linhas: LinhaSaldo[]; toras: Tora[]; itens: ItemFila[]; empresa: string }) {
  const [nome, setNome] = useState("");
  const [busca, setBusca] = useState("");
  const [medidas, setMedidas] = useState<MedidasEncaixe>(vazias);
  const [limite, setLimite] = useState(10);
  const [escolhida, setEscolhida] = useState<LinhaSaldo | null>(null);
  const [salva, setSalva] = useState<Tora | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const plaqueta = useMemo(() => menorPlaquetaLivre(toras, itens, empresa), [toras, itens, empresa]);
  async function confirmar() {
    if (!escolhida || busy) return;
    setBusy(true);
    try {
      const tora = await salvarEncaixe(escolhida, medidas, empresa, toras, {
        listarFila: () => fila().listar(), online: estaOnline, capturar: capturarLog, gravarLog: gravarRegistro,
        enfileirar: (op) => fila().enfileirar(op),
        lerInventario: async () => {
          const todos: Tora[] = [];
          for (let inicio = 0; ; inicio += 1000) {
            const { data, error } = await supabase.from("toras").select("*").eq("empresa_id", empresa).order("plaqueta").range(inicio, inicio + 999);
            if (error) throw error;
            todos.push(...(data ?? []));
            if (!data || data.length < 1000) return todos;
          }
        },
        inserir: async (t, log) => { await registrarOperacao("tora_insert", empresa, t, [], log); },
      });
      setSalva(tora); setEscolhida(null); setMedidas(vazias);
      if (estaOnline()) await qc.invalidateQueries({ queryKey: ["toras"] });
      toast.success(`Plaqueta ${tora.plaqueta} salva${estaOnline() ? "" : " offline — será enviada quando conectar"}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar. Suas medidas foram mantidas."); }
    finally { setBusy(false); }
  }
  const nomes = useMemo(() => nomesCientificosEncaixe(linhas), [linhas]);
  const filtrados = useMemo(() => nomes.filter((n) => n.toLowerCase().includes(busca.trim().toLowerCase())), [nomes, busca]);
  const volume = useMemo(() => volumeEncaixe(medidas), [medidas]);
  const opcoes = useMemo(() => encaixarToras(linhas, nome, volume), [linhas, nome, volume]);
  return <div className="space-y-4">
    {salva && <div className="space-y-2 border-b pb-4" aria-live="polite">
      <p className="font-semibold">Plaqueta azul {salva.plaqueta} · Árvore {salva.arvore} · Secção {salva.secao || "sem seção"}</p>
      <p className="text-sm break-words">AUTEX: {salva.autex}</p>
      <Button asChild className="w-full"><Link to="/etiquetas" search={{ p: String(salva.plaqueta) }}><Printer /> Imprimir plaqueta {salva.plaqueta}</Link></Button>
    </div>}
    {escolhida ? <section className="space-y-3" aria-label="Confirmar encaixe">
      <h3 className="text-xl font-bold">{escolhida.especie}</h3>
      <p className="italic text-sm">{escolhida.nome_cientifico}</p>
      <p className="font-semibold">Árvore {escolhida.arvore} · Secção {escolhida.secao || "sem seção"}</p>
      <p className="break-words text-sm">AUTEX: {escolhida.autex}</p>
      <p className="font-semibold">Plaqueta azul {plaqueta}</p>
      <p>Volume medido: {fmtM3(volume ?? 0)} m³ · Saldo: {fmtM3(escolhida.volume ?? 0)} m³</p>
      <p className="text-sm text-muted-foreground">Confirme a identificação no pátio: volume parecido não comprova a origem da tora.</p>
      <Button disabled={busy} className="w-full h-12" onClick={confirmar}><Check />{busy ? "Salvando…" : "Confirmar identificação e salvar"}</Button>
      <Button disabled={busy} variant="outline" className="w-full" onClick={() => setEscolhida(null)}><RotateCcw /> Escolher outra tora</Button>
    </section> : <>
    <div className="space-y-2">
      <Label htmlFor="encaixe-busca">Nome científico</Label>
      <Input id="encaixe-busca" placeholder="Buscar nome científico" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <Select value={nome} onValueChange={(v) => { setNome(v); setLimite(10); }}>
        <SelectTrigger aria-label="Nome científico do encaixe" className="w-full h-12 [&>span]:truncate"><SelectValue placeholder="Selecionar nome científico" /></SelectTrigger>
        <SelectContent>{filtrados.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}{!filtrados.length && <div className="p-3 text-sm text-muted-foreground">Nenhum nome científico encontrado no saldo.</div>}</SelectContent>
      </Select>
    </div>
    <div className="grid grid-cols-2 gap-3">
      {CAMPOS_ENCAIXE.map((k) => <div key={k} className={k === "comprimento" ? "col-span-2 space-y-1" : "space-y-1"}>
        <Label htmlFor={`encaixe-${k}`}>{rotulos[k]}</Label>
        <Input id={`encaixe-${k}`} inputMode="decimal" className="h-12 text-lg" value={medidas[k]} onChange={(e) => { setMedidas((m) => ({ ...m, [k]: e.target.value })); setLimite(10); }} />
      </div>)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-primary px-4 py-3 text-primary-foreground" aria-live="polite">
      <span>Volume medido</span><b className="text-2xl">{volume === null ? "—" : `${fmtM3(volume)} m³`}</b>
    </div>
    <Button variant="outline" onClick={() => { setMedidas(vazias); setLimite(10); }}><RotateCcw /> Limpar medidas</Button>
    {nome && volume !== null && <section aria-label="Opções de encaixe" className="space-y-2">
      <h3 className="text-xl font-bold">Volumes mais próximos fora de estoque ({opcoes.length})</h3>
      {!opcoes.length && <p className="text-sm text-muted-foreground">Nenhuma tora fora de estoque com volume válido para este nome científico.</p>}
      <ol className="divide-y border-y">
        {opcoes.slice(0, limite).map(({ linha, indice, diferenca }, i) => <li key={indice} className="py-3 space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><b className="text-lg">{i + 1}. {linha.especie || "Sem nome popular"}</b><b>{fmtM3(linha.volume ?? 0)} m³</b></div>
          <div className="font-semibold">Árvore {linha.arvore} · Secção {linha.secao || "—"}</div>
          <div className="text-sm break-words">AUTEX: {linha.autex || "Não informada"}</div>
          <div className="text-sm italic text-muted-foreground break-words">{linha.nome_cientifico}</div>
          <div className="text-sm text-muted-foreground">Diferença (saldo − medido): {diferenca > 0 ? "+" : ""}{fmtM3(diferenca)} m³</div>
          <Button variant="outline" className="w-full h-11" disabled={!linha.autex.trim()} onClick={() => { setEscolhida(linha); setSalva(null); }}><Check /> Escolher árvore {linha.arvore} · {linha.secao || "Sem secção"}</Button>
        </li>)}
      </ol>
      {opcoes.length > limite && <Button variant="outline" className="w-full" onClick={() => setLimite((n) => n + 10)}>Mostrar mais opções</Button>}
    </section>}
    </>}
  </div>;
}
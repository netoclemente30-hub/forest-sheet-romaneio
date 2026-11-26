import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useFilaOffline } from "@/hooks/useFilaOffline";
import { autexQuery, type Arvore, type Tora } from "@/lib/data";
import { projetarDados } from "@/lib/offline/projecao";
import { fmtM3 } from "@/lib/volume";

export const nomeEspecieNormalizado = (nome?: string | null) =>
  (nome ?? "").normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase().replace(/\s+/g, " ");

export type LimiteEspecie = { especie: string; nome_cientifico?: string; volume_m3: number };
export function limitesDe(autex: unknown): LimiteEspecie[] {
  if (!autex || typeof autex !== "object" || !("limites_especies" in autex) || !Array.isArray(autex.limites_especies)) return [];
  return autex.limites_especies.filter((l): l is LimiteEspecie =>
    l && typeof l.especie === "string" && typeof l.volume_m3 === "number" && Number.isFinite(l.volume_m3) && l.volume_m3 >= 0);
}

function mesmaEspecie(a: { especie?: string | null | undefined; nome_cientifico?: string | null | undefined }, b: typeof a) {
  const cientifico = nomeEspecieNormalizado(a.nome_cientifico);
  const outro = nomeEspecieNormalizado(b.nome_cientifico);
  if (cientifico && outro) return cientifico === outro;
  const vulgar = nomeEspecieNormalizado(a.especie);
  return !!vulgar && vulgar === nomeEspecieNormalizado(b.especie);
}

const positivo = (v?: number | null) => v != null && Number.isFinite(v) && v > 0 ? v : 0;
const metros = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 3 });

type Props = {
  toras: Tora[];
  arvores: Arvore[];
  empresa: string | null;
  autex: string | null;
  arvore: number;
  especie?: string | null | undefined;
  nome_cientifico?: string | null | undefined;
  comprimento: number | null;
  volume: number;
  plaquetaAnterior?: number;
};

export function AvisosManejo(p: Props) {
  const autex = useQuery(autexQuery);
  const fila = useFilaOffline();
  const registro = projetarDados("autex", autex.data ?? [], fila.itens, p.empresa).find(a => a.empresa_id === p.empresa && a.numero === p.autex);
  if (!p.empresa || !p.autex) return null;
  const manejo = p.toras.filter(t => t.empresa_id === p.empresa && t.autex === p.autex && t.origem === "manejo");
  const outras = manejo.filter(t => t.plaqueta !== p.plaquetaAnterior);
  const altura = positivo(p.arvores.find(a => a.empresa_id === p.empresa && a.autex === p.autex && a.numero === p.arvore)?.altura);
  const soma = outras.filter(t => t.arvore === p.arvore).reduce((n, t) => n + positivo(t.comprimento), positivo(p.comprimento));
  const excessoAltura = soma - altura;
  const autorizados = limitesDe(registro).filter(l => mesmaEspecie(l, p));
  const autorizado = autorizados.length === 1 ? autorizados[0]?.volume_m3 ?? null : null;
  const especie = manejo.filter(t => mesmaEspecie(t, p));
  const lancado = especie.reduce((n, t) => n + positivo(Number(t.volume)), 0);
  const previsto = especie.filter(t => t.plaqueta !== p.plaquetaAnterior).reduce((n, t) => n + positivo(Number(t.volume)), positivo(p.volume));
  const excesso = autorizado == null ? 0 : previsto - autorizado;
  const acima = excesso > 1e-8;
  const alertaVolume = autorizado != null && (acima || (autorizado > 0 && previsto + 1e-8 >= autorizado * 0.85));
  return <div aria-live="polite" className="space-y-2">
    {alertaVolume && autorizado != null && <div className={`rounded-md border p-3 text-sm ${acima ? "border-destructive text-destructive" : "border-amber-500 bg-amber-500/10"}`}>
      <p className="font-semibold"><AlertTriangle className="mr-1 inline size-4" />{acima ? "Volume autorizado ultrapassado" : "Volume próximo do limite autorizado"}</p>
      <p>AUTEX {p.autex} · {p.especie || p.nome_cientifico}</p>
      <p>Autorizado: {fmtM3(autorizado)} m³ · Já lançado: {fmtM3(lancado)} m³ · Após salvar: {fmtM3(previsto)} m³</p>
      <p>Saldo após salvar: {fmtM3(Math.max(0, -excesso))} m³ · Excedente: {fmtM3(Math.max(0, excesso))} m³</p>
    </div>}
    {altura > 0 && excessoAltura > 1e-8 && <p className="rounded-md border border-amber-500 bg-amber-500/10 p-3 text-sm">
      <AlertTriangle className="mr-1 inline size-4" />Atenção: soma das secções ({metros(soma)} m) ultrapassa a altura comercial cadastrada da árvore ({metros(altura)} m) em {metros(excessoAltura)} m.
    </p>}
  </div>;
}

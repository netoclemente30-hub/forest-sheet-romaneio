import type { Arvore, Tora } from "./data";
import type { ArquivoGerado } from "./arquivo";

/** Formatos idênticos aos cabeçalhos dos exemplos CSV enviados pelo usuário.
 * Cada arquivo trata apenas uma AUTEX de uma empresa.
 */
export type FiltroSinaflor = {
  empresaId: string;
  autex: string;
  inicio: string; // AAAA-MM-DD, inclusive
  fim: string; // AAAA-MM-DD, inclusive
};

function dataLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  // Horário operacional em Rondônia (UTC-4), evitando trocar o dia após 20h.
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Porto_Velho", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(data);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return [valor("year"), valor("month"), valor("day")].join("-");
}

function validarFiltro(f: FiltroSinaflor) {
  if (!f.empresaId || !f.autex) throw new Error("Escolha uma empresa e uma AUTEX antes de gerar o CSV.");
  const valido = (v: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(v + "T00:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  };
  if (!valido(f.inicio) || !valido(f.fim)) throw new Error("Informe a data inicial e a data final.");
  if (f.inicio > f.fim) throw new Error("A data inicial não pode ser posterior à data final.");
}

function noPeriodo(iso: string | null | undefined, f: FiltroSinaflor): boolean {
  const data = dataLocal(iso);
  return data !== "" && data >= f.inicio && data <= f.fim;
}

function nomeSeguro(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60);
}

function csvArquivo(linhas: string[], tipo: "arvores_abatidas" | "toras_tracadas", f: FiltroSinaflor): ArquivoGerado {
  // Modelo de árvores: LF; modelo de toras: CRLF (ambos UTF-8, sem BOM).
  const quebra = tipo === "arvores_abatidas" ? "\n" : "\r\n";
  return {
    blob: new Blob([linhas.join(quebra) + quebra], { type: "text/csv;charset=utf-8" }),
    nome: tipo + "_sinaflor_" + nomeSeguro(f.autex) + "_" + f.inicio + "_a_" + f.fim + ".csv",
  };
}

export function selecionarAbatidas(arvores: Arvore[], f: FiltroSinaflor): Arvore[] {
  validarFiltro(f);
  const numeros = new Set<number>();
  return arvores
    .filter((a) => a.empresa_id === f.empresaId && a.autex === f.autex && noPeriodo(a.abatida_em, f))
    .sort((a, b) => a.numero - b.numero)
    .filter((a) => {
      if (!Number.isInteger(a.numero) || a.numero <= 0 || numeros.has(a.numero)) return false;
      numeros.add(a.numero);
      return true;
    });
}

export function exportarAbatidasCsv(arvores: Arvore[], f: FiltroSinaflor): ArquivoGerado {
  const dados = selecionarAbatidas(arvores, f);
  if (!dados.length) throw new Error("Não há árvores abatidas nesse período e nessa AUTEX.");
  return csvArquivo(["Número da árvore", ...dados.map((a) => String(a.numero))], "arvores_abatidas", f);
}

function numeroValido(v: number | string | null | undefined): boolean {
  return v != null && v !== "" && Number.isFinite(Number(v)) && Number(v) > 0;
}

function completa(t: Tora): boolean {
  return Number.isInteger(Number(t.arvore)) && Number(t.arvore) > 0
    && Boolean(t.secao?.trim()) && /^[a-zA-Z0-9_-]{1,12}$/.test(t.secao?.trim() ?? "")
    && numeroValido(t.d_topo1) && numeroValido(t.d_topo2)
    && numeroValido(t.d_pe1) && numeroValido(t.d_pe2)
    && numeroValido(t.comprimento);
}

export function selecionarTracadas(toras: Tora[], f: FiltroSinaflor): {
  validas: Tora[];
  incompletas: Tora[];
  duplicadas: Tora[];
} {
  validarFiltro(f);
  const chaves = new Set<string>();
  const validas: Tora[] = [];
  const incompletas: Tora[] = [];
  const duplicadas: Tora[] = [];
  const base = toras.filter((t) => t.empresa_id === f.empresaId && t.autex === f.autex
    && t.origem === "manejo" && noPeriodo(t.created_at, f));
  for (const t of [...base].sort((a, b) => a.arvore - b.arvore || (a.secao ?? "").localeCompare(b.secao ?? "", "pt-BR"))) {
    if (!completa(t)) {
      incompletas.push(t);
      continue;
    }
    const chave = String(t.arvore) + "|" + t.secao!.trim().toUpperCase();
    if (chaves.has(chave)) {
      duplicadas.push(t);
      continue;
    }
    chaves.add(chave);
    validas.push(t);
  }
  return { validas, incompletas, duplicadas };
}

function decimalBr(valor: number): string {
  const arredondado = Math.round((valor + Number.EPSILON) * 10000) / 10000;
  return String(arredondado).replace(".", ",");
}

export function linhaTracamento(t: Tora): string {
  if (!completa(t)) throw new Error("Tora " + t.plaqueta + " sem secção ou medidas completas.");
  // Médias dos dois diâmetros medidos em cm por ponta, convertidas para metros.
  const topo = (Number(t.d_topo1) + Number(t.d_topo2)) / 200;
  const pe = (Number(t.d_pe1) + Number(t.d_pe2)) / 200;
  return [t.arvore, t.secao!.trim().toUpperCase(), decimalBr(topo), decimalBr(pe), decimalBr(Number(t.comprimento))].join(";");
}

export function exportarTracadasCsv(toras: Tora[], f: FiltroSinaflor): ArquivoGerado {
  const { validas, incompletas, duplicadas } = selecionarTracadas(toras, f);
  if (incompletas.length) throw new Error(incompletas.length + " tora(s) sem secção ou medidas completas. Corrija antes de exportar.");
  if (duplicadas.length) throw new Error(duplicadas.length + " secção(ões) repetida(s) nesta AUTEX. Verifique antes de exportar.");
  if (!validas.length) throw new Error("Não há toras traçadas nesse período e nessa AUTEX.");
  return csvArquivo(
    ["Nº Árvore;Secção;Diâmetro 1 (m);Diâmetro 2 (m);Comprimento (m)", ...validas.map(linhaTracamento)],
    "toras_tracadas",
    f,
  );
}

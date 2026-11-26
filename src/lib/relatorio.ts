import { adicionarLogoPdf } from "@/lib/logo-gestor";
import type { Tora } from "./data";
import { fmtM3 } from "./volume";
import type { ArquivoGerado } from "./arquivo";
import { medidaComercial, fmtComprimentoComercial } from "./medida-comercial";

export type MedidaRelatorio = "fisica" | "comercial";

export type Ordem = "autex" | "plaqueta_desc" | "plaqueta_asc" | "volume_desc" | "especie_asc" | "especie_desc";
export const ORDENS: { v: Ordem; label: string }[] = [
  { v: "plaqueta_desc", label: "Plaqueta (maior → menor)" },
  { v: "plaqueta_asc", label: "Plaqueta (menor → maior)" },
  { v: "volume_desc", label: "Volume (maior → menor)" },
  { v: "especie_asc", label: "Espécie (A → Z)" },
  { v: "especie_desc", label: "Espécie (Z → A)" },
  { v: "autex", label: "Separar por AUTEX (depois árvore e seção)" },
];

export function ordenarToras(toras: Tora[], ordem: Ordem): Tora[] {
  const esp = (t: Tora) => (t.especie ?? "").toLocaleLowerCase("pt-BR");
  return [...toras].sort((a, b) => {
    switch (ordem) {
      case "plaqueta_desc": return b.plaqueta - a.plaqueta;
      case "plaqueta_asc": return a.plaqueta - b.plaqueta;
      case "volume_desc": return Number(b.volume) - Number(a.volume);
      case "especie_asc": return esp(a).localeCompare(esp(b), "pt-BR") || a.plaqueta - b.plaqueta;
      case "autex": return (a.autex ?? "").localeCompare(b.autex ?? "", "pt-BR") || a.arvore - b.arvore || (a.secao ?? "").localeCompare(b.secao ?? "") || a.plaqueta - b.plaqueta;
      case "especie_desc": return esp(b).localeCompare(esp(a), "pt-BR") || a.plaqueta - b.plaqueta;
    }
  });
}

const HEAD = ["Plaqueta", "Árvore", "Seção", "Espécie", "Nome científico", "D1 topo (cm)", "D2 topo (cm)", "D3 pé (cm)", "D4 pé (cm)", "Comprimento (m)", "Volume (m³)", "AUTEX", "Situação"];
const linha = (t: Tora) => [t.plaqueta, t.arvore, t.secao ?? "", t.especie ?? "", t.nome_cientifico ?? "", t.d_topo1, t.d_topo2, t.d_pe1, t.d_pe2, t.comprimento, Number(Number(t.volume).toFixed(4)), t.autex ?? "", t.carregada ? "Carregada" : "No pátio"];
const nome = () => `relatorio_toras_${new Date().toISOString().slice(0, 10)}`;

export async function exportarExcel(toras: Tora[]): Promise<ArquivoGerado> {
  const XLSX = await import("xlsx");
  const total = toras.reduce((n, t) => n + Number(t.volume), 0);
  const ws = XLSX.utils.aoa_to_sheet([HEAD, ...toras.map(linha), [], ["TOTAL", `${toras.length} toras`, "", "", "", "", "", "", "", "", Number(total.toFixed(4))]]);
  ws["!cols"] = HEAD.map((h) => ({ wch: Math.max(10, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Toras");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["AUTEX", "Qtd toras", "Volume (m³)"], ...resumoPorAutex(toras).map((r) => [r.autex, r.qtd, Number(r.volume.toFixed(4))])]), "Por AUTEX");
  const wsEsp = XLSX.utils.aoa_to_sheet([["Espécie", "Nome científico", "Qtd toras", "Volume (m³)"], ...resumoPorEspecie(toras).map((r) => [r.especie, r.cientifico, r.qtd, Number(r.volume.toFixed(4))])]);
  wsEsp["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsEsp, "Por espécie");
  return { blob: new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nome: `${nome()}.xlsx` };
}

export function dadosPdfToras(toras: Tora[], medida: MedidaRelatorio = "fisica") {
  const comercial = medida === "comercial";
  const medidas = toras.map((t) => medidaComercial(t));
  const volumes = toras.map((t, i) => comercial ? medidas[i]?.volume ?? 0 : Number(t.volume));
  const total = volumes.reduce((soma, volume) => soma + volume, 0);
  const cols = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const head = comercial
    ? ["Plaqueta", "Árvore", "Seção", "Espécie", "Nome científico", "D1 comercial (cm)", "D2 comercial (cm)", "Comprimento comercial (m)", "Volume comercial (m³)", "AUTEX"]
    : cols.map((i) => HEAD[i] ?? "");
  const body = toras.map((t, i) => {
    const m = medidas[i];
    if (comercial) return [t.plaqueta, t.arvore, t.secao ?? "", t.especie ?? "", t.nome_cientifico ?? "", m?.d1 ?? "—", m?.d2 ?? "—", m ? fmtComprimentoComercial(m.comprimento) : "—", m ? fmtM3(m.volume) : "—", t.autex ?? ""].map(String);
    const l = linha(t); l[10] = fmtM3(Number(t.volume));
    return cols.map((j) => String(l[j] ?? ""));
  });
  const foot = head.map(() => "");
  foot[0] = "TOTAL"; foot[1] = `${toras.length} toras`; foot[comercial ? 8 : 10] = fmtM3(total);
  const itens = toras.map((t, i) => ({ ...t, volume: volumes[i] ?? 0 }));
  return { head, body, foot, total, porAutex: resumoPorAutex(itens), porEspecie: resumoPorEspecie(itens), semMedidas: comercial ? medidas.filter((m) => !m).length : 0 };
}

export async function exportarPdf(toras: Tora[], titulo: string, medida: MedidaRelatorio = "fisica"): Promise<ArquivoGerado> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", compress: true });
  await adicionarLogoPdf(doc, 14, 7, 15);
  const dados = dadosPdfToras(toras, medida);
  const comercial = medida === "comercial";
  doc.setFontSize(15);
  doc.text(`RELATÓRIO DE TORAS — ${titulo.toUpperCase()}`, 33, 14);
  doc.setFontSize(9);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")} · ${toras.length} toras · ${fmtM3(dados.total)} m³${comercial ? " · MEDIDA COMERCIAL" : ""}`, 33, 20);
  if (dados.semMedidas) doc.text(`${dados.semMedidas} tora(s) sem medidas completas: volume comercial não incluído nos totais.`, 14, 25);
  autoTable(doc, {
    startY: dados.semMedidas ? 30 : 25,
    head: [dados.head],
    body: dados.body,
    foot: [dados.foot],
    styles: { fontSize: 7.5, overflow: "linebreak", cellPadding: 1.5 },
    columnStyles: { 3: { cellWidth: 30 }, 4: { cellWidth: 42, fontStyle: "italic" }, [dados.head.length - 1]: { cellWidth: 38 } },
    headStyles: { fillColor: [46, 84, 56] },
    footStyles: { fillColor: [230, 225, 205], textColor: 20 },
  });
  autoTable(doc, { startY: (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8, head: [["AUTEX", "Qtd toras", comercial ? "Volume comercial m³" : "Volume m³"]], body: dados.porAutex.map((r) => [r.autex, String(r.qtd), fmtM3(r.volume)]), styles: { fontSize: 9 }, headStyles: { fillColor: [46, 84, 56] } });
  autoTable(doc, { startY: (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8, head: [["Espécie", "Nome científico", "Qtd toras", comercial ? "Volume comercial m³" : "Volume m³"]], body: dados.porEspecie.map((r) => [r.especie, r.cientifico, String(r.qtd), fmtM3(r.volume)]), styles: { fontSize: 9 }, headStyles: { fillColor: [46, 84, 56] } });
  return { blob: doc.output("blob"), nome: `${nome()}${comercial ? "_comercial" : ""}.pdf` };
}

const LIMITE_LINHAS = 12;
const torasPalavra = (n: number) => `${n} ${n === 1 ? "tora" : "toras"}`;

/** Resumo em texto para o WhatsApp, seguindo a medida ativa no relatório. */
export function resumoWhatsappToras(toras: Tora[], titulo: string, medida: MedidaRelatorio = "fisica"): string {
  const dados = dadosPdfToras(toras, medida);
  const comercial = medida === "comercial";
  const linhas: string[] = [
    `*RELATÓRIO DE TORAS — ${titulo.toUpperCase()}*`,
    `Emitido em ${new Date().toLocaleString("pt-BR")} · ${comercial ? "MEDIDA COMERCIAL" : "MEDIDA FÍSICA"}`,
    `${torasPalavra(toras.length)} · ${fmtM3(dados.total)} m³`,
  ];
  const especies = dados.porEspecie.map((e) => `• ${e.especie}${e.cientifico ? ` (${e.cientifico})` : ""}: ${torasPalavra(e.qtd)} · ${fmtM3(e.volume)} m³`);
  if (especies.length) {
    linhas.push("", "Por espécie:");
    linhas.push(...especies.slice(0, LIMITE_LINHAS));
    if (especies.length > LIMITE_LINHAS) linhas.push(`… +${especies.length - LIMITE_LINHAS} outras espécies`);
  }
  const autex = dados.porAutex.map((a) => `• ${a.autex}: ${torasPalavra(a.qtd)} · ${fmtM3(a.volume)} m³`);
  if (autex.length > 1) {
    linhas.push("", "Por AUTEX:");
    linhas.push(...autex.slice(0, LIMITE_LINHAS));
    if (autex.length > LIMITE_LINHAS) linhas.push(`… +${autex.length - LIMITE_LINHAS} outras AUTEX`);
  }
  if (dados.semMedidas) linhas.push("", `${dados.semMedidas} tora(s) sem medidas completas: volume comercial não incluído nos totais.`);
  return linhas.join("\n");
}

export function resumoPorAutex(toras: Tora[]) {
  const m = new Map<string, { autex: string; qtd: number; volume: number }>();
  for (const t of toras) { const k = t.autex || "Sem AUTEX"; const r = m.get(k) ?? { autex: k, qtd: 0, volume: 0 }; r.qtd++; r.volume += Number(t.volume); m.set(k, r); }
  return [...m.values()].sort((a, b) => a.autex.localeCompare(b.autex, "pt-BR"));
}

export function resumoPorEspecie(toras: Tora[]) {
  const m = new Map<string, { especie: string; cientifico: string; qtd: number; volume: number }>();
  for (const t of toras) {
    const esp = t.especie || "Sem espécie";
    const r = m.get(esp) ?? { especie: esp, cientifico: t.nome_cientifico ?? "", qtd: 0, volume: 0 };
    r.qtd++; r.volume += Number(t.volume);
    if (!r.cientifico && t.nome_cientifico) r.cientifico = t.nome_cientifico;
    m.set(esp, r);
  }
  return [...m.values()].sort((a, b) => a.especie.localeCompare(b.especie, "pt-BR"));
}

export function linhaSinaflor(t: Pick<Tora, "arvore" | "secao" | "d_topo1" | "d_topo2" | "d_pe1" | "d_pe2" | "comprimento">) {
  const media = (a: number | null, b: number | null) => (a == null || b == null ? null : Math.round(((Number(a) + Number(b)) / 2 / 100) * 10000) / 10000);
  return [t.arvore, t.secao?.trim().toUpperCase() ?? "", media(t.d_topo1, t.d_topo2), media(t.d_pe1, t.d_pe2), t.comprimento == null ? null : Number(t.comprimento)];
}

export async function exportarSinaflor(toras: Tora[]): Promise<ArquivoGerado> {
  const XLSX = await import("xlsx");
  const head = ["Nº Árvore", "Secção", "D. Médio Topo (m)", "D. Médio Pé (m)", "Comprimento (m)"];
  const ws = XLSX.utils.aoa_to_sheet([head, ...toras.map(linhaSinaflor)]);
  ws["!cols"] = head.map((h) => ({ wch: h.length + 3 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Repique SINAFLOR");
  return { blob: new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nome: `sinaflor_${new Date().toISOString().slice(0, 10)}.xlsx` };
}

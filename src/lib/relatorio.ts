import type { Tora } from "./data";
import { fmtM3 } from "./volume";

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

export async function exportarExcel(toras: Tora[]) {
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
  XLSX.writeFile(wb, `${nome()}.xlsx`);
}

export async function exportarPdf(toras: Tora[], titulo: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape" });
  const total = toras.reduce((n, t) => n + Number(t.volume), 0);
  doc.setFontSize(15);
  doc.text(`RELATÓRIO DE TORAS — ${titulo.toUpperCase()}`, 14, 14);
  doc.setFontSize(9);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")} · ${toras.length} toras · ${fmtM3(total)} m³`, 14, 20);
  const cols = [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12];
  autoTable(doc, {
    startY: 25,
    head: [cols.map((i) => HEAD[i] ?? "")],
    body: toras.map((t) => { const l = linha(t); l[10] = fmtM3(Number(t.volume)); return cols.map((i) => String(l[i] ?? "")); }),
    foot: [["TOTAL", `${toras.length} toras`, "", "", "", "", "", "", "", fmtM3(total), "", ""]],
    styles: { fontSize: 7.5 },
    headStyles: { fillColor: [46, 84, 56] },
    footStyles: { fillColor: [230, 225, 205], textColor: 20 },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autoTable(doc, { startY: (doc as any).lastAutoTable.finalY + 8, head: [["AUTEX", "Qtd toras", "Volume m³"]], body: resumoPorAutex(toras).map((r) => [r.autex, String(r.qtd), fmtM3(r.volume)]), styles: { fontSize: 9 }, headStyles: { fillColor: [46, 84, 56] } });
  autoTable(doc, { startY: (doc as any).lastAutoTable.finalY + 8, head: [["Espécie", "Nome científico", "Qtd toras", "Volume m³"]], body: resumoPorEspecie(toras).map((r) => [r.especie, r.cientifico, String(r.qtd), fmtM3(r.volume)]), styles: { fontSize: 9 }, headStyles: { fillColor: [46, 84, 56] } });
  doc.save(`${nome()}.pdf`);
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

export function linhaSinaflor(t: Pick<Tora, "arvore" | "d_topo1" | "d_topo2" | "d_pe1" | "d_pe2" | "comprimento">) {
  const media = (a: number | null, b: number | null) => (a == null || b == null ? null : Math.round(((Number(a) + Number(b)) / 2 / 100) * 10000) / 10000);
  return [t.arvore, media(t.d_topo1, t.d_topo2), media(t.d_pe1, t.d_pe2), t.comprimento == null ? null : Number(t.comprimento)];
}

export async function exportarSinaflor(toras: Tora[]) {
  const XLSX = await import("xlsx");
  const head = ["Nº Árvore", "D. Médio Topo (m)", "D. Médio Pé (m)", "Comprimento (m)"];
  const ws = XLSX.utils.aoa_to_sheet([head, ...toras.map(linhaSinaflor)]);
  ws["!cols"] = head.map((h) => ({ wch: h.length + 3 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Repique SINAFLOR");
  XLSX.writeFile(wb, `sinaflor_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

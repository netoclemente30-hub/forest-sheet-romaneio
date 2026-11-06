import type { Tora } from "./data";
import { fmtM3 } from "./volume";

export type Ordem = "plaqueta_desc" | "plaqueta_asc" | "volume_desc" | "especie_asc" | "especie_desc";
export const ORDENS: { v: Ordem; label: string }[] = [
  { v: "plaqueta_desc", label: "Plaqueta (maior → menor)" },
  { v: "plaqueta_asc", label: "Plaqueta (menor → maior)" },
  { v: "volume_desc", label: "Volume (maior → menor)" },
  { v: "especie_asc", label: "Espécie (A → Z)" },
  { v: "especie_desc", label: "Espécie (Z → A)" },
];

export function ordenarToras(toras: Tora[], ordem: Ordem): Tora[] {
  const esp = (t: Tora) => (t.especie ?? "").toLocaleLowerCase("pt-BR");
  return [...toras].sort((a, b) => {
    switch (ordem) {
      case "plaqueta_desc": return b.plaqueta - a.plaqueta;
      case "plaqueta_asc": return a.plaqueta - b.plaqueta;
      case "volume_desc": return Number(b.volume) - Number(a.volume);
      case "especie_asc": return esp(a).localeCompare(esp(b), "pt-BR") || a.plaqueta - b.plaqueta;
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
    head: [cols.map((i) => HEAD[i])],
    body: toras.map((t) => { const l = linha(t); l[10] = fmtM3(Number(t.volume)); return cols.map((i) => l[i]); }),
    foot: [["TOTAL", `${toras.length} toras`, "", "", "", "", "", "", "", fmtM3(total), "", ""]],
    styles: { fontSize: 7.5 },
    headStyles: { fillColor: [46, 84, 56] },
    footStyles: { fillColor: [230, 225, 205], textColor: 20 },
  });
  doc.save(`${nome()}.pdf`);
}

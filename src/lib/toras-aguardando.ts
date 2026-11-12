import { volumeTora } from "@/lib/volume";
import { medidaComercial } from "@/lib/medida-comercial";

export type ToraAguardando = {
  id: string; empresa_id: string; numero: number; especie: string; nome_cientifico: string | null;
  d_topo1: number; d_topo2: number; d_pe1: number; d_pe2: number; comprimento: number; volume: number; created_at: string;
};

export type MedidasAguardando = { d_topo1: number; d_topo2: number; d_pe1: number; d_pe2: number; comprimento: number };

/** Próximo número livre da sequência própria das toras aguardando identificação. */
export function proximoNumeroAguardando(lista: Pick<ToraAguardando, "numero">[]): number {
  return lista.reduce((m, t) => Math.max(m, t.numero), 0) + 1;
}

export function codigoAguardando(numero: number) { return `NI-${numero}`; }

/** Físico pelo Smalian do app e comercial pela ponta mais fina; null quando faltam medidas. */
export function volumesAguardando(m: { [K in keyof MedidasAguardando]?: number | undefined }) {
  const ok = [m.d_topo1, m.d_topo2, m.d_pe1, m.d_pe2, m.comprimento].every((n) => typeof n === "number" && Number.isFinite(n) && n > 0);
  if (!ok) return null;
  const v = m as MedidasAguardando;
  const fisico = volumeTora(v);
  return { fisico, comercial: medidaComercial({ ...v, volume: fisico }) };
}

export function qrAguardando(t: Pick<ToraAguardando, "id" | "empresa_id" | "numero" | "especie">) {
  return JSON.stringify({ v: 1, tipo: "nao_identificada", codigo: codigoAguardando(t.numero), id: t.id, empresa: t.empresa_id, especie: t.especie });
}

const f4 = (n: number) => Number(n.toFixed(4));

/** Linhas e totais do relatório (físico e comercial), ordenadas pelo código NI. */
export function relatorioAguardando(toras: ToraAguardando[]) {
  const linhas = [...toras].sort((a, b) => a.numero - b.numero).map((t) => {
    const c = volumesAguardando(t)?.comercial ?? null;
    return { codigo: codigoAguardando(t.numero), especie: t.especie, cientifico: t.nome_cientifico ?? "", data: t.created_at.slice(0, 10).split("-").reverse().join("/"),
      d_topo1: t.d_topo1, d_topo2: t.d_topo2, d_pe1: t.d_pe1, d_pe2: t.d_pe2, comprimento: t.comprimento, fisico: f4(t.volume),
      c_d1: c?.d1 ?? null, c_d2: c?.d2 ?? null, c_comprimento: c?.comprimento ?? null, comercial: f4(c?.volume ?? 0) };
  });
  const mapa = new Map<string, { especie: string; cientifico: string; qtd: number; fisico: number; comercial: number }>();
  for (const l of linhas) {
    const e = mapa.get(l.especie) ?? { especie: l.especie, cientifico: l.cientifico, qtd: 0, fisico: 0, comercial: 0 };
    e.qtd++; e.fisico += l.fisico; e.comercial += l.comercial; mapa.set(l.especie, e);
  }
  const porEspecie = [...mapa.values()].sort((a, b) => b.fisico - a.fisico);
  return { linhas, porEspecie, total: { qtd: linhas.length, fisico: f4(linhas.reduce((s, l) => s + l.fisico, 0)), comercial: f4(linhas.reduce((s, l) => s + l.comercial, 0)) } };
}

const nomeArq = () => `toras_aguardando_identificacao_${new Date().toISOString().slice(0, 10)}`;

export async function excelAguardando(toras: ToraAguardando[], empresa: string) {
  const XLSX = await import("xlsx");
  const r = relatorioAguardando(toras);
  const head = ["Código", "Data", "Espécie", "Nome científico", "DF1 (cm)", "DF2 (cm)", "DF3 (cm)", "DF4 (cm)", "Comprimento (m)", "Volume físico (m³)", "Ø comercial 1 (cm)", "Ø comercial 2 (cm)", "Compr. comercial (m)", "Volume comercial (m³)"];
  const ws = XLSX.utils.aoa_to_sheet([
    [`Toras medidas no pátio — aguardando identificação · ${empresa}`], [`Emitido em ${new Date().toLocaleString("pt-BR")}`], [], head,
    ...r.linhas.map((l) => [l.codigo, l.data, l.especie, l.cientifico, l.d_topo1, l.d_topo2, l.d_pe1, l.d_pe2, l.comprimento, l.fisico, l.c_d1, l.c_d2, l.c_comprimento, l.comercial]),
    ["TOTAL", "", `${r.total.qtd} toras`, "", "", "", "", "", "", r.total.fisico, "", "", "", r.total.comercial],
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([["Espécie", "Nome científico", "Qtd toras", "Volume físico (m³)", "Volume comercial (m³)"], ...r.porEspecie.map((e) => [e.especie, e.cientifico, e.qtd, f4(e.fisico), f4(e.comercial)]), ["TOTAL", "", r.total.qtd, r.total.fisico, r.total.comercial]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Toras");
  XLSX.utils.book_append_sheet(wb, ws2, "Resumo por espécie");
  return { blob: new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nome: `${nomeArq()}.xlsx` };
}

export async function pdfAguardando(toras: ToraAguardando[], empresa: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const { fmtM3 } = await import("@/lib/volume");
  const r = relatorioAguardando(toras);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("TORAS MEDIDAS NO PÁTIO — AGUARDANDO IDENTIFICAÇÃO", 14, 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`${empresa} · Emitido em ${new Date().toLocaleString("pt-BR")} · ${r.total.qtd} toras · Físico ${fmtM3(r.total.fisico)} m³ · Comercial ${fmtM3(r.total.comercial)} m³`, 14, 20);
  doc.text("Toras sem identificação de árvore/seção/autorização; medidas físicas (Smalian) e comerciais (ponta mais fina, comprimento arredondado para baixo de 0,5 m).", 14, 25);
  const n = (v: number | null, d = 2) => v === null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  autoTable(doc, {
    startY: 29,
    head: [["Código", "Data", "Espécie", "Nome científico", "DF1×DF2 (cm)", "DF3×DF4 (cm)", "C (m)", "Físico m³", "Ø com. (cm)", "C com. (m)", "Comercial m³"]],
    body: r.linhas.map((l) => [l.codigo, l.data, l.especie, l.cientifico, `${n(l.d_topo1, 0)}×${n(l.d_topo2, 0)}`, `${n(l.d_pe1, 0)}×${n(l.d_pe2, 0)}`, n(l.comprimento), fmtM3(l.fisico), l.c_d1 === null ? "—" : `${n(l.c_d1, 0)}×${n(l.c_d2, 0)}`, n(l.c_comprimento, 1), fmtM3(l.comercial)]),
    foot: [["TOTAL", "", `${r.total.qtd} toras`, "", "", "", "", fmtM3(r.total.fisico), "", "", fmtM3(r.total.comercial)]],
    styles: { fontSize: 8 }, headStyles: { fillColor: [46, 84, 56] }, footStyles: { fillColor: [230, 230, 220], textColor: 20 },
  });
  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
    head: [["Espécie", "Nome científico", "Qtd toras", "Volume físico m³", "Volume comercial m³"]],
    body: r.porEspecie.map((e) => [e.especie, e.cientifico, String(e.qtd), fmtM3(e.fisico), fmtM3(e.comercial)]),
    foot: [["TOTAL", "", String(r.total.qtd), fmtM3(r.total.fisico), fmtM3(r.total.comercial)]],
    styles: { fontSize: 9 }, headStyles: { fillColor: [46, 84, 56] }, footStyles: { fillColor: [230, 230, 220], textColor: 20 },
  });
  const y = Math.min((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 25, 195);
  doc.line(30, y, 120, y); doc.line(175, y, 265, y);
  doc.text("Responsável técnico", 75, y + 5, { align: "center" }); doc.text("Responsável pela empresa", 220, y + 5, { align: "center" });
  return { blob: doc.output("blob"), nome: `${nomeArq()}.pdf` };
}

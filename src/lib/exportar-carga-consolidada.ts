import type { LinhaCarga } from "./carga-consolidada";
import type { ArquivoGerado } from "./arquivo";
import { fmtM3 } from "./volume";

export async function gerarCargaConsolidada(formato: "xlsx" | "pdf", linhas: LinhaCarga[]): Promise<ArquivoGerado> {
  const colunas = ["Espécie", "Produto", "AUTEX/AUTESP", "Peças", "Volume (m³)"];
  const dados = linhas.map(l => [l.especie, l.produto, l.autorizacao, l.pecas, l.volume]);
  const totais = linhas.reduce((r, l) => ({ pecas: r.pecas + l.pecas, volume: r.volume + l.volume }), { pecas: 0, volume: 0 });
  const nome = `romaneio-consolidado.${formato}`;
  if (formato === "xlsx") {
    const xlsx = await import("xlsx");
    const livro = xlsx.utils.book_new();
    const planilha = xlsx.utils.aoa_to_sheet([colunas, ...dados, ["TOTAL", "", "", totais.pecas, totais.volume]]);
    planilha["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 28 }, { wch: 12 }, { wch: 15 }];
    xlsx.utils.book_append_sheet(livro, planilha, "Carga consolidada");
    return { nome, blob: new Blob([xlsx.write(livro, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
  }
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ format: "a4" });
  doc.setFontSize(15);
  doc.text("Romaneio de carga consolidado", 14, 16);
  autoTable(doc, {
    startY: 23, head: [colunas],
    body: linhas.map(l => [l.especie, l.produto, l.autorizacao, String(l.pecas), fmtM3(l.volume)]),
    foot: [["TOTAL", "", "", String(totais.pecas), fmtM3(totais.volume)]], showFoot: "lastPage",
  });
  return { nome, blob: doc.output("blob") };
}

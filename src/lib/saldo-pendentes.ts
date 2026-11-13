import type { Tora } from "./data";
import type { ItemFila } from "./offline/fila";
import { conferirSaldo, type LinhaSaldo } from "./saldo";
import { linhasDisponiveisOffline } from "./encaixe";
import { fmtM3 } from "./volume";
import { exportarTabelasPdf } from "./relatorios-gerais";
import type { ArquivoGerado } from "./arquivo";

export type SaldoPendente = LinhaSaldo & { plaqueta: number | null };

export function saldoNaoMedido(linhas: LinhaSaldo[], toras: Tora[], itens: ItemFila[], empresa: string | null): SaldoPendente[] {
  if (!empresa) return [];
  const atuais = toras.filter((t) => t.empresa_id === empresa).map((t) => {
    const alteracao = itens.filter(({ op }) => op.tipo === "tora_update" && op.empresa_id === t.empresa_id && op.plaqueta === t.plaqueta).at(-1)?.op;
    return alteracao?.tipo === "tora_update" ? { ...t, ...alteracao.dados } as Tora : t;
  });
  const semMedida = (t: Tora) => !t.carregada && !t.serrada_em && t.d_topo1 === null && t.comprimento === null;
  const res = conferirSaldo(linhas, atuais);
  const vinculadas = new Set(res.flatMap((r) => r.tora ? [r.tora.plaqueta] : []));
  const restantes = res.flatMap((r) => !r.tora || semMedida(r.tora) ? [{ ...r.linha, plaqueta: r.tora?.plaqueta ?? null }] : []);
  restantes.push(...atuais.filter((t) => semMedida(t) && !vinculadas.has(t.plaqueta)).map((t) => ({ autex: t.autex ?? "", arvore: t.arvore, secao: t.secao ?? "", especie: t.especie ?? "", nome_cientifico: t.nome_cientifico ?? "", volume: Number(t.volume), plaqueta: t.plaqueta })));
  const disponiveis = new Set(linhasDisponiveisOffline(restantes, itens, empresa));
  return restantes.filter((l) => disponiveis.has(l));
}

const titulo = "Toras do saldo não medidas";
const cabecalho = ["AUTEX / AUTESP", "Árvore", "Seção", "Espécie", "Nome científico", "Volume do saldo (m³)", "Plaqueta"];
const dados = (lista: SaldoPendente[]) => lista.map((l) => [l.autex, l.arvore ?? "", l.secao, l.especie, l.nome_cientifico, l.volume ?? "", l.plaqueta ?? ""]);

export async function exportarSaldoPendenteExcel(lista: SaldoPendente[]): Promise<ArquivoGerado> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([cabecalho, ...dados(lista), ["TOTAL", lista.length, "", "", "", "", ""]]);
  const fim = lista.length + 1;
  ws[`B${fim + 1}`] = { t: "n", f: `COUNTA(A2:A${fim})`, v: lista.length };
  ws[`F${fim + 1}`] = { t: "n", f: `SUM(F2:F${fim})`, v: lista.reduce((n, l) => n + (l.volume ?? 0), 0), z: "#,##0.0000" };
  for (let r = 2; r <= fim; r++) { const cell = ws[`F${r}`]; if (cell?.t === "n") cell.z = "#,##0.0000"; }
  ws["!cols"] = [30, 12, 10, 24, 32, 24, 12].map((wch) => ({ wch }));
  ws["!autofilter"] = { ref: `A1:G${fim}` };
  XLSX.utils.book_append_sheet(wb, ws, "Toras não medidas");
  return { nome: `toras_nao_medidas_${new Date().toISOString().slice(0, 10)}.xlsx`, blob: new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
}

export function exportarSaldoPendentePdf(lista: SaldoPendente[]) {
  return exportarTabelasPdf(titulo, "Volume informado no saldo; medidas físicas e comerciais ainda não realizadas", [{ titulo: `${lista.length} toras aguardando medição`, cabecalho, linhas: dados(lista).map((r, i) => r.map((v, c) => c === 5 ? fmtM3(lista[i]?.volume ?? 0) : v)), rodape: ["TOTAL", lista.length, "", "", "", fmtM3(lista.reduce((n, l) => n + (l.volume ?? 0), 0)), ""] }]);
}
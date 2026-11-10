import type { Romaneio, Tora } from "./data";
import type { PacoteSerrado, CargaSerrada } from "./madeira-serrada";
import type { ArquivoGerado } from "./arquivo";
import { fmtM3 } from "./volume";

export type Periodo = { inicio: string; fim: string; especie: string };
export type Tabela = { titulo: string; cabecalho: string[]; linhas: (string | number)[][]; rodape?: (string | number)[] };

const norm = (s: string | null | undefined) => (s ?? "").trim().toLocaleLowerCase("pt-BR");
const dia = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");
const noPeriodo = (d: string, p: Pick<Periodo, "inicio" | "fim">) => !!d && (!p.inicio || d >= p.inicio) && (!p.fim || d <= p.fim);
const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/** Aproveitamento (%) = madeira serrada produzida ÷ volume de toras serradas × 100. */
export function aproveitamento(volumeToras: number, volumeSerrado: number): number | null {
  return volumeToras > 0 ? Math.round((volumeSerrado / volumeToras) * 10000) / 100 : null;
}

export function rendimentoDesdobro(toras: Tora[], pacotes: PacoteSerrado[], p: Periodo) {
  const m = new Map<string, { especie: string; qtdToras: number; volToras: number; pecas: number; volSerrado: number }>();
  const get = (nome: string) => {
    const k = norm(nome) || "sem espécie";
    const r = m.get(k) ?? { especie: nome.trim() || "Sem espécie", qtdToras: 0, volToras: 0, pecas: 0, volSerrado: 0 };
    m.set(k, r);
    return r;
  };
  const filtroEsp = norm(p.especie);
  for (const t of toras) {
    if (!t.serrada_em || !noPeriodo(dia(t.serrada_em), p)) continue;
    if (filtroEsp && norm(t.especie) !== filtroEsp) continue;
    const r = get(t.especie ?? "");
    r.qtdToras++;
    r.volToras += Number(t.volume);
  }
  for (const pc of pacotes) {
    if (!noPeriodo(dia(pc.data), p)) continue;
    for (const i of pc.itens) {
      if (filtroEsp && norm(i.especie) !== filtroEsp) continue;
      const r = get(i.especie);
      r.pecas += i.total_pecas;
      r.volSerrado += Number(i.volume_m3);
    }
  }
  const linhas = [...m.values()].sort((a, b) => a.especie.localeCompare(b.especie, "pt-BR")).map((r) => ({ ...r, volToras: r4(r.volToras), volSerrado: r4(r.volSerrado), rendimento: aproveitamento(r.volToras, r.volSerrado) }));
  const total = linhas.reduce((t, r) => ({ qtdToras: t.qtdToras + r.qtdToras, volToras: t.volToras + r.volToras, pecas: t.pecas + r.pecas, volSerrado: t.volSerrado + r.volSerrado }), { qtdToras: 0, volToras: 0, pecas: 0, volSerrado: 0 });
  return { linhas, total: { ...total, volToras: r4(total.volToras), volSerrado: r4(total.volSerrado), rendimento: aproveitamento(total.volToras, total.volSerrado) } };
}

const pct = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);
const brData = (d: string) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");

export function tabelaRendimento(toras: Tora[], pacotes: PacoteSerrado[], p: Periodo): Tabela[] {
  const { linhas, total } = rendimentoDesdobro(toras, pacotes, p);
  return [{
    titulo: "Rendimento do desdobro",
    cabecalho: ["Espécie", "Toras serradas", "Volume toras (m³)", "Peças", "Madeira serrada (m³)", "Rendimento"],
    linhas: linhas.map((r) => [r.especie, r.qtdToras, fmtM3(r.volToras), r.pecas, fmtM3(r.volSerrado), pct(r.rendimento)]),
    rodape: ["TOTAL", total.qtdToras, fmtM3(total.volToras), total.pecas, fmtM3(total.volSerrado), pct(total.rendimento)],
  }];
}

export function tabelaRomaneios(roms: Romaneio[], cargas: Omit<CargaSerrada, "pacotes">[], p: Periodo): Tabela[] {
  const rt = roms.filter((r) => noPeriodo(dia(r.data), p));
  const rc = cargas.filter((c) => noPeriodo(dia(c.data), p));
  return [
    {
      titulo: "Romaneios de toras",
      cabecalho: ["Data", "Motorista", "CPF", "Placa", "Pátio", "Toras", "Volume (m³)", "Situação"],
      linhas: rt.map((r) => [brData(r.data), r.motorista ?? "", r.cpf ?? "", [r.placa, r.julieta].filter(Boolean).join(" / "), r.patio ?? "", r.qtd_toras, fmtM3(Number(r.total_volume)), r.recebido_em ? "Recebido" : "Em trânsito"]),
      rodape: ["TOTAL", `${rt.length} romaneios`, "", "", "", rt.reduce((n, r) => n + r.qtd_toras, 0), fmtM3(rt.reduce((n, r) => n + Number(r.total_volume), 0)), ""],
    },
    {
      titulo: "Romaneios de madeira serrada",
      cabecalho: ["Data", "Carga", "Cliente", "Motorista", "Placa", "Peças", "Volume (m³)"],
      linhas: rc.map((c) => [brData(c.data), c.numero_carga, c.cliente_nome, c.motorista_nome, [c.placa_veiculo, c.placa_reboque].filter(Boolean).join(" / "), c.total_pecas, fmtM3(Number(c.total_volume_m3))]),
      rodape: ["TOTAL", `${rc.length} cargas`, "", "", "", rc.reduce((n, c) => n + c.total_pecas, 0), fmtM3(rc.reduce((n, c) => n + Number(c.total_volume_m3), 0))],
    },
  ];
}

/** Estoque: toras de manejo não carregadas, toras no pátio da serraria ainda não serradas, pacotes sem carga. */
export function estoqueConsolidado(toras: Tora[], roms: Romaneio[], pacotes: PacoteSerrado[], especie: string) {
  const recebidos = new Set(roms.filter((r) => r.recebido_em).map((r) => r.id));
  const f = norm(especie);
  const ok = (e: string | null) => !f || norm(e) === f;
  const manejo = toras.filter((t) => t.origem === "manejo" && !t.carregada && ok(t.especie));
  const patio = toras.filter((t) => !t.serrada_em && (t.origem === "serraria" || (!!t.romaneio_id && recebidos.has(t.romaneio_id))) && ok(t.especie));
  const agrupa = (ls: Tora[]) => {
    const m = new Map<string, { especie: string; qtd: number; volume: number }>();
    for (const t of ls) { const k = t.especie?.trim() || "Sem espécie"; const r = m.get(k) ?? { especie: k, qtd: 0, volume: 0 }; r.qtd++; r.volume += Number(t.volume); m.set(k, r); }
    return [...m.values()].sort((a, b) => a.especie.localeCompare(b.especie, "pt-BR"));
  };
  const mad = new Map<string, { especie: string; bitola: string; pecas: number; volume: number }>();
  for (const pc of pacotes) {
    if (pc.carga_id) continue;
    for (const i of pc.itens) {
      if (!ok(i.especie)) continue;
      const bitola = `${i.grossura}x${i.largura} ${i.tipo_peca}`.trim();
      const k = `${i.especie}|${bitola}`;
      const r = mad.get(k) ?? { especie: i.especie, bitola, pecas: 0, volume: 0 };
      r.pecas += i.total_pecas; r.volume += Number(i.volume_m3); mad.set(k, r);
    }
  }
  return { manejo: agrupa(manejo), patio: agrupa(patio), madeira: [...mad.values()].sort((a, b) => a.especie.localeCompare(b.especie, "pt-BR") || a.bitola.localeCompare(b.bitola)) };
}

export function tabelaEstoque(toras: Tora[], roms: Romaneio[], pacotes: PacoteSerrado[], especie: string): Tabela[] {
  const e = estoqueConsolidado(toras, roms, pacotes, especie);
  const tab = (titulo: string, ls: { especie: string; qtd: number; volume: number }[]): Tabela => ({
    titulo, cabecalho: ["Espécie", "Toras", "Volume (m³)"], linhas: ls.map((r) => [r.especie, r.qtd, fmtM3(r.volume)]),
    rodape: ["TOTAL", ls.reduce((n, r) => n + r.qtd, 0), fmtM3(ls.reduce((n, r) => n + r.volume, 0))],
  });
  return [
    tab("Toras de manejo (na floresta, não carregadas)", e.manejo),
    tab("Toras no pátio da serraria (não serradas)", e.patio),
    { titulo: "Madeira serrada em estoque (pacotes sem carga)", cabecalho: ["Espécie", "Bitola", "Peças", "Volume (m³)"], linhas: e.madeira.map((r) => [r.especie, r.bitola, r.pecas, fmtM3(r.volume)]), rodape: ["TOTAL", "", e.madeira.reduce((n, r) => n + r.pecas, 0), fmtM3(e.madeira.reduce((n, r) => n + r.volume, 0))] },
  ];
}

const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export async function exportarTabelasExcel(nome: string, tabelas: Tabela[]): Promise<ArquivoGerado> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  tabelas.forEach((t, i) => {
    const ws = XLSX.utils.aoa_to_sheet([t.cabecalho, ...t.linhas, ...(t.rodape ? [[], t.rodape] : [])]);
    ws["!cols"] = t.cabecalho.map((h) => ({ wch: Math.max(12, h.length + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, `${i + 1} ${t.titulo}`.slice(0, 31).replace(/[\\/?*[\]:]/g, ""));
  });
  return { blob: new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nome: `${slug(nome)}_${new Date().toISOString().slice(0, 10)}.xlsx` };
}

export async function exportarTabelasPdf(nome: string, filtro: string, tabelas: Tabela[]): Promise<ArquivoGerado> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", compress: true });
  doc.setFontSize(15);
  doc.text(nome.toUpperCase(), 14, 14);
  doc.setFontSize(9);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}${filtro ? ` · ${filtro}` : ""}`, 14, 20);
  let y = 26;
  for (const t of tabelas) {
    doc.setFontSize(11);
    doc.text(t.titulo, 14, y + 2);
    autoTable(doc, { startY: y + 5, head: [t.cabecalho], body: t.linhas.length ? t.linhas.map((l) => l.map(String)) : [[`Sem registros`, ...t.cabecalho.slice(1).map(() => "")]], ...(t.rodape ? { foot: [t.rodape.map(String)] } : {}), styles: { fontSize: 8 }, headStyles: { fillColor: [46, 84, 56] }, footStyles: { fillColor: [230, 225, 205], textColor: 20 } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
    if (y > 180) { doc.addPage(); y = 14; }
  }
  return { blob: doc.output("blob"), nome: `${slug(nome)}_${new Date().toISOString().slice(0, 10)}.pdf` };
}

import { adicionarLogoPdf } from "@/lib/logo-gestor";
import type { ArquivoGerado } from './arquivo';
import { totaisImportados, type CabImportado, type PecaImportada } from './romaneio-serrado-importar';

export type DocExportar = { cab: CabImportado; itens: PecaImportada[] };
const m3 = (i: PecaImportada) => i.grossura * i.largura * i.comprimento * i.quantidade / 10000;
const br = (n: number, d = 4) => n.toFixed(d).replace('.', ',');
const dataBr = (d: string) => d.split('-').reverse().join('/');
const arquivoBase = (cab: CabImportado) => `romaneio_${cab.numero_carga.replace(/[^\w.-]+/g, '_') || 'serrado'}`;

/** Agrupa por madeira e depois por bitola, na ordem de comprimento. */
export function blocosPorEspecie(itens: PecaImportada[]) {
  const especies = new Map<string, Map<string, PecaImportada[]>>();
  for (const i of itens) {
    const e = especies.get(i.especie) ?? new Map<string, PecaImportada[]>();
    const k = `${i.grossura}x${i.largura}`;
    e.set(k, [...(e.get(k) ?? []), i]);
    especies.set(i.especie, e);
  }
  return [...especies].map(([especie, b]) => ({ especie, bitolas: [...b.values()].map(ps => [...ps].sort((a, c) => a.comprimento - c.comprimento)) }));
}

/** Excel no modelo do romaneio (uma aba por madeira), relido pela importação. */
export async function planilhaImportado(doc: DocExportar): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx');
  const book = XLSX.utils.book_new();
  const usados = new Set<string>();
  for (const { especie, bitolas } of blocosPorEspecie(doc.itens)) {
    const primeiro = bitolas[0]?.[0];
    const rows: (string | number)[][] = [
      [`ROMANEIO: ${doc.cab.numero_carga}`, '', `DATA: ${dataBr(doc.cab.data)}`],
      [`CLIENTE: ${doc.cab.cliente_nome}`],
      [`ESSENCIA: ${especie}`],
      [`NOME CIENTÍFICO: ${primeiro?.nome_cientifico ?? ''}`, '', `AUTEX: ${[...new Set(bitolas.flat().map(p => p.autex).filter(Boolean))].join(', ')}`],
      [`MOTORISTA: ${doc.cab.motorista_nome}`, '', `PLACAS: ${[doc.cab.placa_veiculo, doc.cab.placa_reboque].filter(Boolean).join(' / ')}`],
      [],
    ];
    for (const ps of bitolas) {
      rows.push(['BITOLA', ps[0]!.grossura], ['LARG.', ps[0]!.largura], ['COMP.', 'QUANT.', 'M³']);
      for (const p of ps) rows.push([p.comprimento, p.quantidade, Number(br(m3(p)).replace(',', '.'))]);
      rows.push(['TOTAL', ps.reduce((n, p) => n + p.quantidade, 0), Number(ps.reduce((n, p) => n + m3(p), 0).toFixed(4))], []);
    }
    const t = totaisImportados(bitolas.flat());
    rows.push(['TOTAL GERAL', t.pecas, t.volume]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 22 }];
    let nome = (especie || 'MADEIRA').replace(/[\\/?*[\]:]/g, ' ').slice(0, 28);
    while (usados.has(nome)) nome = `${nome.slice(0, 26)}_${usados.size}`;
    usados.add(nome);
    XLSX.utils.book_append_sheet(book, ws, nome);
  }
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}
export async function gerarExcelImportado(doc: DocExportar): Promise<ArquivoGerado> {
  const out = await planilhaImportado(doc);
  return { blob: new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nome: `${arquivoBase(doc.cab)}.xlsx` };
}

export async function gerarPdfImportado(doc: DocExportar, empresaNome: string): Promise<ArquivoGerado> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const css = getComputedStyle(document.documentElement);
  const tk = (n: string) => css.getPropertyValue(`--serrado-pdf-${n}`).trim();
  const forest = tk('forest'), paper = tk('paper'), ink = tk('ink'), muted = tk('muted'), line = tk('line');
  const { cab } = doc; const tot = totaisImportados(doc.itens);
  pdf.setFillColor(forest); pdf.rect(0, 0, 210, 25, 'F');
  await adicionarLogoPdf(pdf, 10, 4, 17);
  pdf.setTextColor(paper); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.text(empresaNome, 31, 9);
  pdf.setFontSize(14); pdf.text('ROMANEIO DE CARGA — MADEIRA SERRADA', 31, 19);
  pdf.setFontSize(9); pdf.text(`${cab.numero_carga} · ${dataBr(cab.data)}`, 200, 9, { align: 'right' });
  const getY = () => (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40;
  autoTable(pdf, { startY: 30, margin: { left: 10, right: 10 }, theme: 'grid', styles: { fontSize: 8.5, cellPadding: 2.5, textColor: ink, lineColor: line }, headStyles: { fillColor: forest, textColor: paper },
    head: [['CLIENTE', 'MOTORISTA', 'PLACAS', 'RESUMO']],
    body: [[`${cab.cliente_nome || '—'}\nCNPJ/CPF: ${cab.cliente_documento || '—'}`, `${cab.motorista_nome || '—'}\nCPF: ${cab.motorista_cpf || '—'}`, `Caminhão: ${cab.placa_veiculo || '—'}\nReboque: ${cab.placa_reboque || '—'}`, `${tot.pecas} peças\n${br(tot.volume)} m³`]] });
  const body: string[][] = []; const sub: number[] = [];
  for (const { especie, bitolas } of blocosPorEspecie(doc.itens)) for (const ps of bitolas) {
    for (const p of ps) body.push([`${especie}${p.nome_cientifico ? `\n${p.nome_cientifico}` : ''}`, p.autex || '—', `${br(p.grossura, 1)} × ${br(p.largura, 1)}`, br(p.comprimento, 2), String(p.quantidade), br(m3(p))]);
    sub.push(body.length);
    body.push([`Subtotal ${especie} ${br(ps[0]!.grossura, 1)} × ${br(ps[0]!.largura, 1)}`, '', '', '', String(ps.reduce((n, p) => n + p.quantidade, 0)), br(ps.reduce((n, p) => n + m3(p), 0))]);
  }
  autoTable(pdf, { startY: getY() + 5, margin: { left: 10, right: 10, bottom: 18 }, theme: 'grid', styles: { fontSize: 8, cellPadding: 1.6, halign: 'center', textColor: ink, lineColor: line, lineWidth: 0.1 },
    headStyles: { fillColor: forest, textColor: paper }, columnStyles: { 0: { halign: 'left', cellWidth: 62 } },
    head: [['Madeira / Nome científico', 'AUTEX', 'Bitola (cm)', 'Comp. (m)', 'Peças', 'Vol. (m³)']], body,
    foot: [['TOTAL GERAL', '', '', '', String(tot.pecas), br(tot.volume)]], showFoot: 'lastPage', footStyles: { fillColor: forest, textColor: paper },
    didParseCell: d => { if (d.section === 'body' && sub.includes(d.row.index)) { d.cell.styles.fillColor = muted; d.cell.styles.fontStyle = 'bold'; if (d.column.index === 0) d.cell.colSpan = 4; } if (d.section === 'foot' && d.column.index === 0) d.cell.colSpan = 4; } });
  let y = getY() + 8;
  if (cab.observacoes) { pdf.setTextColor(ink); pdf.setFontSize(8.5); const l = pdf.splitTextToSize(`Observações: ${cab.observacoes}`, 190); pdf.text(l, 10, y); y += l.length * 4; }
  y += 18; if (y > 275) { pdf.addPage(); y = 40; }
  pdf.setDrawColor(line); pdf.setTextColor(ink); pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal');
  ['Conferente da Serraria', 'Motorista', 'Recebedor/Cliente'].forEach((t, i) => { const x = 10 + i * 65; pdf.line(x, y, x + 58, y); pdf.text(t, x + 29, y + 5, { align: 'center' }); });
  const n = pdf.getNumberOfPages();
  for (let p = 1; p <= n; p++) { pdf.setPage(p); pdf.setFontSize(8); pdf.setTextColor(ink); pdf.text(`${empresaNome} · ${cab.numero_carga}`, 10, 290); pdf.text(`${p} / ${n}`, 200, 290, { align: 'right' }); }
  return { blob: pdf.output('blob'), nome: `${arquivoBase(cab)}.pdf` };
}

import type { ArquivoGerado } from './arquivo';
import { COMPRIMENTOS, comoBitola, type CargaSerrada } from './madeira-serrada';

export function linhasCarga(carga: CargaSerrada) {
  const totais = Object.fromEntries(COMPRIMENTOS.map(c => [c, 0]));
  let pecas = 0, volume = 0;
  const linhas: { cells: string[]; subtotal: boolean }[] = [];
  for (const pacote of [...carga.pacotes].sort((a,b) => a.numero.localeCompare(b.numero, 'pt-BR', {numeric:true}))) {
    let pp = 0, pv = 0;
    const pt = Object.fromEntries(COMPRIMENTOS.map(c => [c, 0]));
    for (const item of pacote.itens) {
      const bitola = comoBitola(item);
      for (const c of COMPRIMENTOS) { const n = bitola.distribuicao_pecas[c] ?? 0; pt[c] = (pt[c] ?? 0) + n; totais[c] = (totais[c] ?? 0) + n; }
      pp += item.total_pecas; pv += Number(item.volume_m3);
      linhas.push({ subtotal:false, cells:[`${pacote.numero}${pacote.autex ? `\nAUTEX ${pacote.autex}` : ''}`, `${item.especie}\n${item.tipo_peca}`, `${item.grossura} × ${item.largura}`, ...COMPRIMENTOS.map(c => bitola.distribuicao_pecas[c] ? String(bitola.distribuicao_pecas[c]) : '–'), String(item.total_pecas), Number(item.volume_m3).toFixed(4).replace('.',',')] });
    }
    pecas += pp; volume += pv;
    linhas.push({ subtotal:true, cells:[`Subtotal Pacote ${pacote.numero}`, '', '', ...COMPRIMENTOS.map(c => pt[c] ? String(pt[c]) : '–'), String(pp), pv.toFixed(4).replace('.',',')] });
  }
  return { linhas, totais, pecas, volume };
}
export async function gerarPdfRomaneioSerrado(carga: CargaSerrada, empresaNome: string): Promise<ArquivoGerado> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4', compress:true });
  const css = getComputedStyle(document.documentElement);
  const token = (nome: string) => css.getPropertyValue(`--serrado-pdf-${nome}`).trim();
  const forest = token('forest'), paper = token('paper'), ink = token('ink'), muted = token('muted'), line = token('line');
  const resumo = linhasCarga(carga);
  doc.setFillColor(forest); doc.rect(0,0,297,25,'F');
  doc.setTextColor(paper); doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text(empresaNome,10,9); doc.setFontSize(15); doc.text('ROMANEIO DE CARGA — MADEIRA SERRADA',10,19);
  doc.setFontSize(9); doc.text(`${carga.numero_carga} · ${carga.data.split('-').reverse().join('/')}`,287,9,{align:'right'});
  autoTable(doc, {
    startY:30, margin:{left:10,right:10}, theme:'grid',
    styles:{fontSize:9,cellPadding:3,textColor:ink,lineColor:line},
    headStyles:{fillColor:forest,textColor:paper},
    head:[['CLIENTE / DESTINATÁRIO','MOTORISTA / TRANSPORTADOR','PLACAS','RESUMO DA CARGA']],
    body:[[`${carga.cliente_nome}\nCNPJ/CPF: ${carga.cliente_documento || '—'}`,`${carga.motorista_nome}\nCPF: ${carga.motorista_cpf || '—'}`,`Caminhão: ${carga.placa_veiculo}\nReboque: ${carga.placa_reboque || '—'}`,`${carga.pacotes.length} pacotes · ${resumo.pecas} peças\n${resumo.volume.toFixed(4).replace('.',',')} m³`]],
  });
  const getY = () => (doc as unknown as {lastAutoTable?:{finalY:number}}).lastAutoTable?.finalY ?? 55;
  autoTable(doc, {
    startY:getY()+6, margin:{left:10,right:10,top:14,bottom:22}, theme:'grid',
    styles:{fontSize:6.8,cellPadding:1.4,halign:'center',textColor:ink,lineColor:line,lineWidth:0.1},
    headStyles:{fillColor:forest,textColor:paper,fontStyle:'bold'},
    columnStyles:{0:{cellWidth:17},1:{cellWidth:31,halign:'left'},2:{cellWidth:20},20:{cellWidth:16},21:{cellWidth:21}},
    head:[['Pacote','Espécie / Peça','Bitola (cm)',...COMPRIMENTOS.map(c=>`${c}m`),'Tot Pçs','Vol (m³)']],
    body:resumo.linhas.map(l=>l.cells),
    foot:[['TOTAL GERAL DA CARGA','','',...COMPRIMENTOS.map(c=>String(resumo.totais[c])),String(resumo.pecas),resumo.volume.toFixed(4).replace('.',',')]],
    showFoot:'lastPage', footStyles:{fillColor:forest,textColor:paper,fontStyle:'bold'},
    didParseCell: data => {
      if (data.section === 'body' && resumo.linhas[data.row.index]?.subtotal) { data.cell.styles.fillColor = muted; data.cell.styles.fontStyle = 'bold'; if (data.column.index===0) { data.cell.colSpan=3; data.cell.styles.halign='left'; } }
      if (data.section==='foot' && data.column.index===0) { data.cell.colSpan=3; data.cell.styles.halign='left'; }
    },
  });
  let y = getY()+17;
  if (y > 184) { doc.addPage(); y = 35; }
  doc.setDrawColor(line); doc.setTextColor(ink); doc.setFontSize(9); doc.setFont('helvetica','normal');
  ['Conferente da Serraria','Motorista Transportador','Recebedor/Cliente'].forEach((label,i)=>{ const x=15+i*94; doc.line(x,y,x+80,y); doc.text(label,x+40,y+5,{align:'center'}); });
  const pages = doc.getNumberOfPages();
  for (let p=1;p<=pages;p++) { doc.setPage(p); doc.setTextColor(ink); doc.setFontSize(8); doc.text(`${empresaNome} · ${carga.numero_carga}`,10,202); doc.text(`${p} / ${pages}`,287,202,{align:'right'}); }
  return { blob:doc.output('blob'), nome:`romaneio-madeira-serrada-${carga.numero_carga.replace(/[^\p{L}\p{N}-]/gu,'-')}.pdf` };
}
import { adicionarLogoPdf } from "@/lib/logo-gestor";
import type { ArquivoGerado } from './arquivo';
import type { RomaneioImportado } from './romaneio-serrado-importado';

const br = (n:number,d=4)=>n.toFixed(d).replace('.',',');
const volume = (i:{grossura:number;largura:number;comprimento:number;quantidade:number}) => i.grossura*i.largura*i.comprimento*i.quantidade/10000;
const nomeArquivo = (r:RomaneioImportado, ext:string) => `romaneio-importado-${r.cab.numero_carga.replace(/[^\p{L}\p{N}-]/gu,'-')}.${ext}`;

/** Linhas do romaneio importado: medidas como foram importadas, volume por linha. */
export function linhasImportado(r:RomaneioImportado) {
  return r.itens.map(i=>({especie:i.especie,nome_cientifico:i.nome_cientifico,autex:i.autex,tipo:i.tipo_peca,grossura:i.grossura,largura:i.largura,comprimento:i.comprimento,quantidade:i.quantidade,volume:Number(volume(i).toFixed(4))}));
}

export async function excelImportado(r:RomaneioImportado, empresaNome:string): Promise<ArquivoGerado> {
  const XLSX = await import('xlsx');
  const c = r.cab;
  const aoa:(string|number)[][] = [
    [empresaNome],['ROMANEIO DE MADEIRA SERRADA (IMPORTADO)'],
    ['Romaneio',c.numero_carga,'Data',c.data.split('-').reverse().join('/')],
    ['Cliente',c.cliente_nome,'CPF/CNPJ',c.cliente_documento],
    ['Motorista',c.motorista_nome,'CPF',c.motorista_cpf],
    ['Caminhão',c.placa_veiculo,'Reboque',c.placa_reboque],
    ...(c.toras_serradas?.length?[['Toras já serradas',c.toras_serradas.map(t=>`AUTEX ${t.autex} · ${t.numero}`).join('; ')]]:[]),
    [],
    ['Espécie','Nome científico','AUTEX','Tipo de peça','Espessura (cm)','Largura (cm)','Comprimento (m)','Quantidade','Volume (m³)'],
    ...linhasImportado(r).map(l=>[l.especie,l.nome_cientifico,l.autex,l.tipo,l.grossura,l.largura,l.comprimento,l.quantidade,l.volume]),
    ['TOTAL','','','','','','',r.total_pecas,Number(r.total_volume_m3)],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa); const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Romaneio');
  const buf = XLSX.write(wb,{type:'array',bookType:'xlsx'}) as ArrayBuffer;
  return { blob:new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), nome:nomeArquivo(r,'xlsx') };
}

export async function pdfImportado(r:RomaneioImportado, empresaNome:string): Promise<ArquivoGerado> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4', compress:true });
  const css = getComputedStyle(document.documentElement);
  const t = (n:string)=>css.getPropertyValue(`--serrado-pdf-${n}`).trim();
  const forest=t('forest')||'#1f4d36', paper=t('paper')||'#ffffff', ink=t('ink')||'#1a1a1a', line=t('line')||'#bbbbbb';
  const c = r.cab;
  doc.setFillColor(forest); doc.rect(0,0,297,25,'F');
  await adicionarLogoPdf(doc, 10, 4, 17);
  doc.setTextColor(paper); doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.text(empresaNome,31,9);
  doc.setFontSize(15); doc.text('ROMANEIO DE MADEIRA SERRADA',31,19);
  doc.setFontSize(9); doc.text(`${c.numero_carga} · ${c.data.split('-').reverse().join('/')}`,287,9,{align:'right'});
  autoTable(doc,{startY:30,margin:{left:10,right:10},theme:'grid',styles:{fontSize:9,cellPadding:3,textColor:ink,lineColor:line},headStyles:{fillColor:forest,textColor:paper},
    head:[['CLIENTE / DESTINATÁRIO','MOTORISTA','PLACAS','RESUMO']],
    body:[[`${c.cliente_nome}\nCNPJ/CPF: ${c.cliente_documento||'—'}`,`${c.motorista_nome||'—'}\nCPF: ${c.motorista_cpf||'—'}`,`Caminhão: ${c.placa_veiculo||'—'}\nReboque: ${c.placa_reboque||'—'}`,`${r.total_pecas} peças\n${br(Number(r.total_volume_m3))} m³`]]});
  const getY=()=>(doc as unknown as {lastAutoTable?:{finalY:number}}).lastAutoTable?.finalY??55;
  if (c.toras_serradas?.length) { doc.setTextColor(ink); doc.setFontSize(8); const txt=doc.splitTextToSize(`Toras já serradas: ${c.toras_serradas.map(x=>`AUTEX ${x.autex} · ${x.numero}`).join('; ')}`,277); doc.text(txt,10,getY()+5); }
  autoTable(doc,{startY:getY()+(c.toras_serradas?.length?12:6),margin:{left:10,right:10,bottom:15},theme:'grid',styles:{fontSize:8,cellPadding:1.6,textColor:ink,lineColor:line,lineWidth:0.1},headStyles:{fillColor:forest,textColor:paper},footStyles:{fillColor:forest,textColor:paper,fontStyle:'bold'},
    head:[['Espécie','Nome científico','AUTEX','Peça','Esp. (cm)','Larg. (cm)','Comp. (m)','Qtd','Vol (m³)']],
    body:linhasImportado(r).map(l=>[l.especie,l.nome_cientifico,l.autex,l.tipo,String(l.grossura).replace('.',','),String(l.largura).replace('.',','),String(l.comprimento).replace('.',','),String(l.quantidade),br(l.volume)]),
    foot:[['TOTAL','','','','','','',String(r.total_pecas),br(Number(r.total_volume_m3))]],showFoot:'lastPage'});
  if (c.observacoes) { doc.setTextColor(ink); doc.setFontSize(8); doc.text(doc.splitTextToSize(`Observações: ${c.observacoes}`,277),10,Math.min(getY()+6,195)); }
  const pages=doc.getNumberOfPages();
  for(let p=1;p<=pages;p++){doc.setPage(p);doc.setTextColor(ink);doc.setFontSize(8);doc.text(`${empresaNome} · ${c.numero_carga}`,10,203);doc.text(`${p} / ${pages}`,287,203,{align:'right'});}
  return { blob:doc.output('blob'), nome:nomeArquivo(r,'pdf') };
}

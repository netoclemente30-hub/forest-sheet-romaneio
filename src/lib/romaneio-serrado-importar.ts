
export type PecaImportada = { id:string; especie:string; nome_cientifico:string; autex:string; tipo_peca:string; grossura:number; largura:number; comprimento:number; quantidade:number };
export type CabImportado = { numero_carga:string; data:string; cliente_nome:string; cliente_documento:string; motorista_nome:string; motorista_cpf:string; placa_veiculo:string; placa_reboque:string; observacoes:string; toras_serradas?:ToraSerradaRef[] };
/** Referência histórica textual a uma tora já serrada; não liga estoque nem pacote. */
export type ToraSerradaRef = { autex:string; numero:string };
export const normalizarRef = (v:string) => v.replace(/\s+/g,' ').trim().toUpperCase();
export function adicionarToraSerrada(lista:ToraSerradaRef[], autex:string, numero:string):ToraSerradaRef[] {
  const ref={autex:normalizarRef(autex),numero:normalizarRef(numero)};
  if(!ref.autex||!ref.numero)throw new Error('Informe a AUTEX e o número da tora');
  if(ref.autex.length>60||ref.numero.length>30)throw new Error('AUTEX ou número da tora muito longo');
  if(lista.some(t=>normalizarRef(t.autex)===ref.autex&&normalizarRef(t.numero)===ref.numero))throw new Error(`Tora ${ref.numero} da AUTEX ${ref.autex} já foi adicionada`);
  return [...lista,ref];
}
export type AbaRomaneio = { nome:string; cliente:string; itens:PecaImportada[]; avisos:string[] };
const texto = (v:unknown) => String(v??'').trim();
const normalizar = (v:unknown) => texto(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
function numero(v:unknown) { if(typeof v==='number')return v; const s=texto(v);return s ? Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s) : 0; }

export function lerAbaRomaneio(nome:string, linhas:unknown[][]):AbaRomaneio {
  const itens:PecaImportada[]=[]; const avisos:string[]=[]; let especie=''; let cliente='';
  for(const row of linhas)for(let c=0;c<row.length;c++) {
    const t=normalizar(row[c]);
    if(t.startsWith('ESSENCIA:')||t.startsWith('ESPECIE:'))especie=texto(row[c]).split(':').slice(1).join(':').trim()||texto(row[c+1]);
    if(t.startsWith('CLIENTE:'))cliente=texto(row[c]).split(':').slice(1).join(':').trim()||texto(row[c+1]);
  }
  for(let r=0;r<linhas.length;r++)for(let c=0;c<(linhas[r]?.length??0);c++) {
    if(normalizar(linhas[r]?.[c])!=='BITOLA')continue;
    const grossura=numero(linhas[r]?.[c+1]); const largura=numero(linhas[r+1]?.[c+1]);
    if(!normalizar(linhas[r+1]?.[c]).startsWith('LARG')||!normalizar(linhas[r+2]?.[c]).startsWith('COMP'))continue;
    for(let k=r+3;k<linhas.length;k++) {
      const raw=linhas[k]?.[c]; if(normalizar(raw).startsWith('TOTAL')||normalizar(raw)==='BITOLA')break;
      const q=numero(linhas[k]?.[c+1]); if(!q)continue;
      const comprimento=numero(raw);
      if(!Number.isSafeInteger(q)||q<0)throw new Error(`${nome}: quantidade inválida na linha ${k+1}`);
      if(!Number.isFinite(comprimento)||comprimento<=0)throw new Error(`${nome}: comprimento inválido na linha ${k+1}`);
      if(!grossura||!largura)avisos.push(`Linha ${k+1}: preencha grossura e largura antes de salvar.`);
      itens.push({id:`${nome}:${r}:${c}:${k}`,especie,nome_cientifico:'',autex:'',tipo_peca:'Outro',grossura,largura,comprimento,quantidade:q});
    }
  }
  if(itens.length&&!especie)avisos.push('Nome da madeira não informado na aba. Preencha antes de salvar.');
  return {nome,cliente,itens,avisos:[...new Set(avisos)]};
}
export async function lerRomaneioExcel(buffer:ArrayBuffer):Promise<AbaRomaneio[]> {
  const XLSX = await import("xlsx");
  const book=XLSX.read(buffer,{type:'array'});
  return book.SheetNames.map(nome=>{const sheet=book.Sheets[nome];return lerAbaRomaneio(nome,sheet?XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:'',blankrows:true}):[]);});
}
export function totaisImportados(itens:PecaImportada[]) {
  return {pecas:itens.reduce((n,i)=>n+i.quantidade,0),volume:Math.round((itens.reduce((n,i)=>n+i.grossura*i.largura*i.comprimento*i.quantidade/10000,0)+Number.EPSILON)*10000)/10000};
}
export function validarImportado(cab:CabImportado,itens:PecaImportada[]) {
  if(!cab.numero_carga.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(cab.data))throw new Error('Informe número e data do romaneio');
  if(!itens.length||itens.length>2000)throw new Error('Informe de 1 a 2000 linhas de peças');
  for(const i of itens) {
    if(!i.especie.trim()||!i.tipo_peca.trim())throw new Error('Preencha nome da madeira e tipo de peça');
    if(!Number.isFinite(i.grossura)||i.grossura<=0||i.grossura>1000||!Number.isFinite(i.largura)||i.largura<=0||i.largura>1000||!Number.isFinite(i.comprimento)||i.comprimento<=0||i.comprimento>100)throw new Error('Preencha medidas positivas: grossura/largura até 1000 cm e comprimento até 100 m');
    if(!Number.isSafeInteger(i.quantidade)||i.quantidade<1||i.quantidade>1000000)throw new Error('Quantidade deve ser inteira entre 1 e 1000000');
  }
  const refs=cab.toras_serradas;
  if(refs!==undefined){if(!Array.isArray(refs)||refs.length>2000)throw new Error('Lista de toras serradas inválida');refs.reduce<ToraSerradaRef[]>((l,t)=>adicionarToraSerrada(l,String(t?.autex??''),String(t?.numero??'')),[]);}
  if(totaisImportados(itens).pecas>2147483647)throw new Error('Quantidade de peças excede o limite');
}
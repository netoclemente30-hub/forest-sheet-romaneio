import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { lerRomaneioExcel, totaisImportados, validarImportado, type CabImportado } from './romaneio-serrado-importar';

const cab:CabImportado={numero_carga:'JAIR7',data:'2026-11-17',cliente_nome:'',cliente_documento:'',motorista_nome:'',motorista_cpf:'',placa_veiculo:'',placa_reboque:'',observacoes:''};
function arquivo(){const b=XLSX.utils.book_new();XLSX.utils.book_append_sheet(b,XLSX.utils.aoa_to_sheet([['CLIENTE: Rita','','','','ESSENCIA: MIRINDIBA'],['BITOLA',2.5,'','','BITOLA',2.5],['LARG.',8,'','','LARG.',15],['COMP.','QUANT.','T. DE M³','','COMP.','QUANT.','T. DE M³'],[1.5,15,999,'',1.5,39,999],[7.5,0,0,'',7.3,2,999],['TOTAL DE M³','',999]]),'JAIR7');XLSX.utils.book_append_sheet(b,XLSX.utils.aoa_to_sheet([['BITOLA'],['LARG.'],['COMP.','QUANT.'],[1,0]]),'Vazia');return XLSX.write(b,{type:'array',bookType:'xlsx'}) as ArrayBuffer;}
describe('romaneio importado',()=>{
  it('lê blocos lado a lado e mantém as abas separadas sem importar totais',async()=>{const abas=(await lerRomaneioExcel(arquivo()));expect(abas).toHaveLength(2);expect(abas[0]?.itens).toHaveLength(3);expect(abas[1]?.itens).toHaveLength(0);expect(abas[0]?.cliente).toBe('Rita');expect(abas[0]?.itens[0]?.especie).toBe('MIRINDIBA');});
  it('preserva 2 peças de 7,30 m sem arredondar para 7,50 m',async()=>{const i=(await lerRomaneioExcel(arquivo()))[0]?.itens??[];expect(i[2]).toMatchObject({comprimento:7.3,quantidade:2,grossura:2.5,largura:15});expect(totaisImportados([i[2] as typeof i[number]]).volume).toBe(0.0548);});
  it('calcula o volume pelas medidas e quantidades, não pelo total da planilha',async()=>{expect(totaisImportados((await lerRomaneioExcel(arquivo()))[0]?.itens??[])).toEqual({pecas:56,volume:0.3191});});
  it('permite nome científico e AUTEX manual e recalcula após edição',async()=>{const i=(await lerRomaneioExcel(arquivo()))[0]?.itens[0];if(!i)throw new Error('fixture ausente');const edit={...i,especie:'Outra madeira',nome_cientifico:'Nome informado',autex:'AUTEX LIVRE',largura:10,comprimento:3,quantidade:4};expect(()=>validarImportado(cab,[edit])).not.toThrow();expect(totaisImportados([edit])).toEqual({pecas:4,volume:0.03});});
  it('não aceita quantidade fracionária',async()=>{const i=(await lerRomaneioExcel(arquivo()))[0]?.itens[0];if(!i)throw new Error('fixture ausente');expect(()=>validarImportado(cab,[{...i,quantidade:1.5}])).toThrow('Quantidade');});
  it('não salva medidas ausentes ou nome da madeira vazio',async()=>{const i=(await lerRomaneioExcel(arquivo()))[0]?.itens[0];if(!i)throw new Error('fixture ausente');expect(()=>validarImportado(cab,[{...i,grossura:0}])).toThrow('medidas');expect(()=>validarImportado(cab,[{...i,especie:''}])).toThrow('nome da madeira');});
});import { adicionarToraSerrada } from './romaneio-serrado-importar';
describe('toras já serradas no romaneio importado',()=>{
  it('aceita 39A e 422B na AUTEX 41234, normalizando espaços e maiúsculas',()=>{expect(adicionarToraSerrada(adicionarToraSerrada([],' 41234 ',' 39a '),'41234','422b')).toEqual([{autex:'41234',numero:'39A'},{autex:'41234',numero:'422B'}]);});
  it('preserva zeros à esquerda',()=>{expect(adicionarToraSerrada([],'007','0039')).toEqual([{autex:'007',numero:'0039'}]);});
  it('rejeita campo vazio',()=>{expect(()=>adicionarToraSerrada([],'41234','  ')).toThrow('Informe a AUTEX e o número');expect(()=>adicionarToraSerrada([],'','39A')).toThrow('Informe a AUTEX e o número');});
  it('rejeita duplicada após normalizar',()=>{expect(()=>adicionarToraSerrada([{autex:'41234',numero:'39A'}],'41234',' 39a')).toThrow('já foi adicionada');});
  it('documento legado sem lista continua válido e lista duplicada é recusada ao salvar',async()=>{const i=(await lerRomaneioExcel(arquivo()))[0]?.itens[0];if(!i)throw new Error('fixture ausente');expect(()=>validarImportado(cab,[i])).not.toThrow();expect(()=>validarImportado({...cab,toras_serradas:[{autex:'1',numero:'2'},{autex:'1',numero:' 2'}]},[i])).toThrow('já foi adicionada');});
});

import { describe, expect, it } from 'vitest';
import { planilhaImportado } from './romaneio-serrado-exportar';
import { lerRomaneioExcel } from './romaneio-serrado-importar';

const cab = { numero_carga:'R-1', data:'2026-11-17', cliente_nome:'Cliente X', cliente_documento:'', motorista_nome:'', motorista_cpf:'', placa_veiculo:'', placa_reboque:'', observacoes:'' };
const p = (id:string,especie:string,comprimento:number,quantidade:number) => ({id,especie,nome_cientifico:'',autex:'',tipo_peca:'Outro',grossura:5,largura:15,comprimento,quantidade});

describe('Excel do romaneio importado', () => {
  it('reimporta peças, 7,30 m e madeiras separadas por aba', async () => {
    const a = await planilhaImportado({cab,itens:[p('1','MIRINDIBA',7.3,12),p('2','MIRINDIBA',4,3),p('3','IPE',2.5,5)]});
    const abas = await lerRomaneioExcel(a);
    expect(abas.map(x=>x.nome)).toEqual(['MIRINDIBA','IPE']);
    expect(abas[0]!.cliente).toBe('Cliente X');
    expect(abas[0]!.itens.map(i=>[i.especie,i.comprimento,i.quantidade])).toEqual([['MIRINDIBA',4,3],['MIRINDIBA',7.3,12]]);
    expect(abas[1]!.itens[0]!.quantidade).toBe(5);
  });
});

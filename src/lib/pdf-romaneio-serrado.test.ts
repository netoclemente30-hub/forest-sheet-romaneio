import { expect, it } from 'vitest';
import { linhasCarga } from './pdf-romaneio-serrado';
import type { CargaSerrada, PacoteSerrado } from './madeira-serrada';
it('totaliza peças por comprimento entre pacotes e bitolas', () => {
  const pacote = (numero:string, n:number):PacoteSerrado => ({id:numero,empresa_id:'empresa',numero,autex:'AUTEX-LIVRE',data:'2026-11-08',observacoes:'',created_at:'',carga_id:'carga',itens:[{id:numero,pacote_id:numero,empresa_id:'empresa',especie:'Cupiúba',tipo_peca:'Viga',grossura:5,largura:15,distribuicao_pecas:{'6.0':n},total_pecas:n,volume_m3:n*0.045}]});
  const carga:CargaSerrada={id:'carga',empresa_id:'empresa',numero_carga:'Carga 01',data:'2026-11-08',cliente_nome:'Cliente',cliente_documento:'',motorista_nome:'Motorista',motorista_cpf:'',placa_veiculo:'AAA1234',placa_reboque:'',total_pecas:15,total_volume_m3:0.675,created_at:'',pacotes:[pacote('25',10),pacote('23',5)]};
  const r=linhasCarga(carga);
  expect(r.pecas).toBe(15);expect(r.volume).toBeCloseTo(0.675,4);expect(r.totais['6.0']).toBe(15);expect(r.totais['1.0']).toBe(0);
  expect(r.linhas.filter(l=>l.subtotal)).toHaveLength(2);
});
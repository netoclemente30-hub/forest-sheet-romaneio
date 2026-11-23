import type { DadosNfe, ItemNfe } from './nfe-txt';
import type { ProdutoFiscal } from './catalogo-fiscal';

export function cargaManual(data: string): DadosNfe {
  return { numero: '', data, itens: [] };
}
export function itemDoCadastro(produto?: ProdutoFiscal): ItemNfe {
  return { codigo: produto?.codigo ?? '', descricao: produto?.descricao ?? '', ncm: produto?.ncm ?? '', unidade: produto?.unidade ?? 'M3', quantidade: 0 };
}
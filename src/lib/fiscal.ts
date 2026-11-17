import type { DadosNfe } from "./nfe-txt";
import { cnpjValido } from "./cnpj";

export type Cadastro = { nome: string; cnpj: string; ie: string };
export type ContaFiscal = { cadastro: Cadastro; assinatura: boolean; historico: Rascunho[] };
export type Rascunho = ReturnType<typeof montarRascunho>;
export const contaNova = (): ContaFiscal => ({
  cadastro: { nome: "", cnpj: "", ie: "" },
  assinatura: false,
  historico: [],
});
export const chaveFiscal = (usuario: string, empresa: string) =>
  ["fiscal-spedy-v1", usuario, empresa].join(":");

export function montarRascunho(
  cadastro: Cadastro,
  carga: DadosNfe,
  origem: string,
  cliente: string,
  precos: string[],
) {
  if (!cadastro.nome.trim() || !cnpjValido(cadastro.cnpj) || !cadastro.ie.trim())
    throw new Error("Revise o cadastro do emitente.");
  if (!cliente.trim() || !carga.itens.length)
    throw new Error("Confira o destinatário e os itens da carga.");
  const itens = carga.itens.map((item, index) => {
    const valor = precos[index]?.trim().replace(",", ".");
    if (
      !valor ||
      !/^\d{1,8}(\.\d{1,2})?$/.test(valor) ||
      Number(valor) <= 0 ||
      !Number.isFinite(item.quantidade) ||
      item.quantidade <= 0
    )
      throw new Error("Informe quantidade e preço positivos em todos os itens.");
    return {
      ...item,
      preco: Number(valor),
      centavos: Math.round(item.quantidade * Number(valor) * 100),
    };
  });
  return {
    origem,
    cadastro: { ...cadastro },
    carga: {
      ...carga,
      cliente: { nome: cliente.trim(), documento: carga.cliente?.documento || "" },
    },
    itens,
    total: itens.reduce((s, i) => s + i.centavos, 0),
    criado: new Date().toISOString(),
    assinado: false,
  };
}

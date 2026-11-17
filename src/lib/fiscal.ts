import type { DadosNfe } from "./nfe-txt";
import { cnpjValido } from "./cnpj";

export type Cadastro = {
  nome: string;
  cnpj: string;
  ie: string;
  endereco?: DetalhesNota["endereco"];
};
export const modalidadesFrete = {
  "0": "CIF · Frete por conta do remetente",
  "1": "FOB · Frete por conta do destinatário",
  "2": "Frete por conta de terceiros",
  "3": "Transporte próprio do remetente",
  "4": "Transporte próprio do destinatário",
  "9": "Sem ocorrência de transporte",
} as const;
export const camposEndereco = {
  logradouro: "Logradouro",
  numero: "Número",
  complemento: "Complemento",
  bairro: "Bairro",
  municipio: "Município",
  uf: "UF",
  cep: "CEP",
} as const;
export type DetalhesNota = {
  cabecalho?: { natureza: string; serie: string; numero: string; finalidade: string };
  nome: string;
  documento: string;
  endereco: Record<keyof typeof camposEndereco, string>;
  modFrete: keyof typeof modalidadesFrete | "";
  infAdFisco: string;
};
export function detalhesIniciais(carga: DadosNfe): DetalhesNota {
  return {
    nome: carga.cliente?.nome ?? "",
    documento: carga.cliente?.documento ?? "",
    endereco: {
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      municipio: "",
      uf: "",
      cep: "",
    },
    modFrete: "",
    infAdFisco: "",
  };
}
export type InutilizacaoRascunho = {
  id: string;
  serie: number;
  inicio: number;
  fim: number;
  justificativa: string;
};
export type ContaFiscal = {
  cadastro: Cadastro;
  assinatura: boolean;
  historico: Rascunho[];
  inutilizacoes?: InutilizacaoRascunho[];
};
export type Rascunho = Omit<ReturnType<typeof montarRascunho>, "detalhes"> & {
  detalhes?: DetalhesNota;
  id?: string;
};
export const idRascunho = (r: Rascunho) => r.id ?? r.origem;
export function copiarRascunho(r: Rascunho): Rascunho {
  const copia = structuredClone(r);
  if (copia.detalhes) {
    copia.detalhes.cabecalho = {
      natureza: copia.detalhes.cabecalho?.natureza ?? copia.carga.natureza ?? "",
      serie: copia.detalhes.cabecalho?.serie ?? "",
      numero: "",
      finalidade: copia.detalhes.cabecalho?.finalidade ?? "1",
    };
  }
  return {
    ...copia,
    id: crypto.randomUUID(),
    assinado: false,
    criado: new Date().toISOString(),
  };
}
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
  detalhes: DetalhesNota,
  precos: string[],
  fiscais: { codigo: string; descricao: string; ncm: string; cfop: string }[] = [],
) {
  if (!cadastro.nome.trim() || !cnpjValido(cadastro.cnpj) || !cadastro.ie.trim())
    throw new Error("Revise o cadastro do emitente.");
  if (!detalhes.nome.trim() || !carga.itens.length)
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
      ...fiscais[index],
      preco: Number(valor),
      centavos: Math.round(item.quantidade * Number(valor) * 100),
    };
  });
  return {
    origem,
    detalhes,
    cadastro: { ...cadastro },
    carga: {
      ...carga,
      cliente: { nome: detalhes.nome.trim(), documento: detalhes.documento.trim() },
    },
    itens,
    total: itens.reduce((s, i) => s + i.centavos, 0),
    criado: new Date().toISOString(),
    assinado: false,
  };
}

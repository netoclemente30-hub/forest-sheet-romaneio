import { camposEndereco, type DetalhesNota } from "./fiscal";
export type ClienteFiscal = Pick<DetalhesNota, "nome" | "documento" | "endereco">;
export type ProdutoFiscal = {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  preco: string;
};
export type CatalogoFiscal = { clientes: ClienteFiscal[]; produtos: ProdutoFiscal[] };
export const documentoId = (valor: string) => valor.replace(/[./\s-]/g, "").toUpperCase();
export function lerCatalogo(prefixo: string): CatalogoFiscal {
  const clientes: ClienteFiscal[] = [];
  const produtos: ProdutoFiscal[] = [];
  for (let n = 0; n < localStorage.length; n++) {
    const chave = localStorage.key(n);
    if (!chave?.startsWith(prefixo)) continue;
    const registro = localStorage.getItem(chave);
    if (!registro) continue;
    if (chave.startsWith(prefixo + "cliente:")) clientes.push(JSON.parse(registro));
    if (chave.startsWith(prefixo + "produto:")) produtos.push(JSON.parse(registro));
  }
  return {
    clientes: clientes.sort((a, b) => a.nome.localeCompare(b.nome)),
    produtos: produtos.sort((a, b) => a.descricao.localeCompare(b.descricao)),
  };
}
export async function consultarCnpj(cnpj: string, signal: AbortSignal): Promise<ClienteFiscal> {
  const id = documentoId(cnpj);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(id)) throw new Error("Confira o CNPJ.");
  const resposta = await fetch("https://brasilapi.com.br/api/cnpj/v1/" + id, {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!resposta.ok)
    throw new Error(
      resposta.status === 404
        ? "CNPJ não encontrado. Preencha manualmente."
        : "Consulta indisponível. Preencha manualmente.",
    );
  const r = await resposta.json();
  if (documentoId(String(r.cnpj ?? "")) !== id || !r.razao_social)
    throw new Error("Cadastro não confirmado. Confira o CNPJ.");
  const endereco = {} as ClienteFiscal["endereco"];
  for (const campo of Object.keys(camposEndereco) as (keyof typeof camposEndereco)[])
    endereco[campo] = String(r[campo] ?? "").trim();
  return { nome: String(r.razao_social), documento: id, endereco };
}

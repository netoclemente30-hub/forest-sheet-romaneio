import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { DadosFiscaisNota } from "./DadosFiscaisNota";
import { ConsultaCnpjFiscal } from "./ConsultaCnpjFiscal";
import { detalhesIniciais } from "@/lib/fiscal";
import {
  documentoId,
  type CatalogoFiscal as Catalogo,
  type ClienteFiscal,
  type ProdutoFiscal,
} from "@/lib/catalogo-fiscal";
const vazio = () => detalhesIniciais({ numero: "", data: "", itens: [] });
const produtoVazio = () => ({ codigo: "", descricao: "", ncm: "", cfop: "", preco: "" });
export function CadastrosFiscais({
  catalogo,
  gravar,
}: {
  catalogo: Catalogo;
  gravar: (
    tipo: "cliente" | "produto",
    id: string,
    registro: ClienteFiscal | ProdutoFiscal,
  ) => boolean;
}) {
  const [aba, setAba] = useState("Clientes");
  const [cliente, setCliente] = useState(vazio);
  const [produto, setProduto] = useState(produtoVazio);
  const [consultar, setConsultar] = useState("");
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="text-xl font-bold">Cadastros fiscais</h2>
      <div className="flex gap-2">
        {["Clientes", "Produtos"].map((a) => (
          <Button
            type="button"
            variant={a === aba ? "default" : "outline"}
            key={a}
            onClick={() => setAba(a)}
          >
            {a}
          </Button>
        ))}
      </div>
      {aba === "Clientes" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const { nome, documento, endereco } = cliente;
            if (gravar("cliente", documentoId(documento), { nome, documento, endereco })) {
              setConsultar("");
              setCliente(vazio());
            }
          }}
        >
          <label>
            Consultar cadastro de cliente
            <select
              className="block w-full rounded border bg-background p-2"
              value={
                catalogo.clientes.some(
                  (c) => documentoId(c.documento) === documentoId(cliente.documento),
                )
                  ? documentoId(cliente.documento)
                  : ""
              }
              onChange={(e) => {
                setConsultar("");
                const c = catalogo.clientes.find(
                  (c) => documentoId(c.documento) === e.target.value,
                );
                setCliente({ ...vazio(), ...c });
              }}
            >
              <option value="">Novo cliente</option>
              {catalogo.clientes.map((c) => (
                <option key={c.documento} value={documentoId(c.documento)}>
                  {c.nome} · {c.documento}
                </option>
              ))}
            </select>
          </label>
          <DadosFiscaisNota
            secao="cliente"
            dados={cliente}
            alterar={(d) => {
              if (d.documento !== cliente.documento) {
                setConsultar(d.documento);
                const salvo = catalogo.clientes.find(
                  (c) => documentoId(c.documento) === documentoId(d.documento),
                );
                if (salvo) {
                  setConsultar("");
                  setCliente({ ...d, ...salvo });
                  return;
                }
              }
              setCliente(d);
            }}
          />
          <ConsultaCnpjFiscal
            documento={consultar}
            aplicar={(c) => setCliente((d) => ({ ...d, ...c }))}
          />
          <Button>Salvar cliente</Button>
        </form>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              gravar("produto", produto.codigo.trim(), {
                ...produto,
                codigo: produto.codigo.trim(),
              })
            )
              setProduto(produtoVazio());
          }}
        >
          <label>
            Consultar cadastro de produto
            <select
              className="block w-full rounded border bg-background p-2"
              value={
                catalogo.produtos.some((p) => p.codigo === produto.codigo) ? produto.codigo : ""
              }
              onChange={(e) =>
                setProduto(
                  catalogo.produtos.find((p) => p.codigo === e.target.value) ?? produtoVazio(),
                )
              }
            >
              <option value="">Novo produto</option>
              {catalogo.produtos.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.codigo} · {p.descricao}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ["codigo", "Código do item"],
              ["descricao", "Descrição do produto"],
              ["ncm", "NCM"],
              ["cfop", "CFOP padrão"],
              ["preco", "Preço padrão por m³ (R$)"],
            ] as const
          ).map(([k, label]) => (
            <label key={k}>
              {label}
              <Input
                required={k !== "preco"}
                maxLength={k === "ncm" ? 8 : k === "cfop" ? 4 : 100}
                pattern={
                  k === "ncm"
                    ? "[0-9]{8}"
                    : k === "cfop"
                      ? "[0-9]{4}"
                      : k === "preco"
                        ? "[0-9]{1,8}([.,][0-9]{1,2})?"
                        : ".*\\S.*"
                }
                value={produto[k]}
                onChange={(e) => setProduto({ ...produto, [k]: e.target.value })}
              />
            </label>
          ))}
          <Button>Salvar produto</Button>
        </form>
      )}
    </section>
  );
}

import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ConsultaCnpjFiscal } from "./ConsultaCnpjFiscal";
import { camposEndereco, chaveFiscal } from "@/lib/fiscal";
import { documentoId, lerCatalogo } from "@/lib/catalogo-fiscal";
import { clientesUnicos, type ClienteSalvo } from "@/lib/cadastros-empresa";
import type { ClienteRomaneio as Cliente } from "@/lib/romaneio-salvar";
import { toast } from "sonner";
export const clienteRomaneioVazio: Cliente = {
  nome: "",
  documento: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  municipio: "",
  uf: "",
  cep: "",
};
const idCliente = (cliente: ClienteSalvo) =>
  documentoId(cliente.documento ?? "") || "nome:" + cliente.nome.toLowerCase();
export function ClienteRomaneio({
  empresa,
  usuario,
  salvos,
  cliente,
  alterar,
}: {
  empresa: string;
  usuario: string;
  salvos: ClienteSalvo[];
  cliente: Cliente;
  alterar: (c: Cliente) => void;
}) {
  const prefixo = chaveFiscal(usuario, empresa) + ":cadastros:";
  const [catalogo, setCatalogo] = useState(() => lerCatalogo(prefixo));
  const [consulta, setConsulta] = useState("");
  const clientes = clientesUnicos([
    ...catalogo.clientes.map((c) => ({ ...c, ...c.endereco })),
    ...salvos,
  ]);
  const [editar, setEditar] = useState(!cliente.nome);
  function selecionar(c: ClienteSalvo) {
    const selecionado = { ...clienteRomaneioVazio };
    for (const campo of Object.keys(selecionado) as (keyof Cliente)[]) {
      selecionado[campo] = typeof c[campo] === "string" ? c[campo] : "";
    }
    alterar(selecionado);
    setConsulta("");
    setEditar(true);
  }
  function salvar() {
    if (
      !cliente.nome.trim() ||
      !documentoId(cliente.documento) ||
      Object.keys(camposEndereco).some(
        (c) => c !== "complemento" && !cliente[c as keyof Cliente]?.trim(),
      )
    ) {
      toast.error("Preencha nome, CPF/CNPJ e endereço completo do cliente.");
      return;
    }
    try {
      const endereco = Object.fromEntries(
        Object.keys(camposEndereco).map((k) => [k, cliente[k as keyof Cliente]]),
      );
      localStorage.setItem(
        prefixo + "cliente:" + documentoId(cliente.documento),
        JSON.stringify({
          nome: cliente.nome.trim(),
          documento: cliente.documento.trim(),
          endereco,
        }),
      );
      setCatalogo(lerCatalogo(prefixo));
      setEditar(false);
      toast.success(
        "Cliente salvo neste aparelho. Os dados também serão guardados na nuvem junto do romaneio.",
      );
    } catch {
      toast.error("Não foi possível salvar o cliente neste aparelho.");
    }
  }
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="font-semibold">Cliente / fornecedor do manejo</h2>
      <p className="text-sm">
        Selecione a pessoa ou empresa do manejo, como João. Os dados preencherão a NF-e de entrada.
      </p>
      <label className="block">
        Selecionar cliente cadastrado
        <select
          className="block w-full rounded border bg-background p-2"
          value={
            clientes.some((c) => idCliente(c) === idCliente(cliente)) ? idCliente(cliente) : ""
          }
          onChange={(e) => {
            const c = clientes.find((c) => idCliente(c) === e.target.value);
            if (c) selecionar(c);
          }}
        >
          <option value="">Selecione o cliente</option>
          {clientes.map((c) => (
            <option key={idCliente(c)} value={idCliente(c)}>
              {c.nome} · {c.documento}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            alterar({ ...clienteRomaneioVazio });
            setConsulta("");
            setEditar(true);
          }}
        >
          Cadastrar novo cliente
        </Button>
        {cliente.nome && (
          <Button type="button" variant="outline" onClick={() => setEditar(!editar)}>
            Editar dados do cliente
          </Button>
        )}
      </div>
      {!editar && cliente.nome && (
        <p>
          {cliente.nome} · {cliente.documento} · {cliente.logradouro}, {cliente.numero} ·{" "}
          {cliente.municipio}/{cliente.uf}
        </p>
      )}
      {editar && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["documento", "CPF / CNPJ"],
                ["nome", "Nome / razão social"],
                ...Object.entries(camposEndereco),
              ] as [keyof Cliente, string][]
            ).map(([campo, label]) => (
              <label key={campo}>
                {label}
                <Input
                  aria-label={label}
                  maxLength={campo === "uf" ? 2 : campo === "documento" ? 18 : 120}
                  value={cliente[campo]}
                  onChange={(e) => {
                    const valor = campo === "uf" ? e.target.value.toUpperCase() : e.target.value;
                    if (campo === "documento") setConsulta(valor);
                    alterar({ ...cliente, [campo]: valor });
                  }}
                />
              </label>
            ))}
          </div>
          <ConsultaCnpjFiscal
            documento={consulta}
            aplicar={(c) =>
              alterar({
                ...clienteRomaneioVazio,
                nome: c.nome,
                documento: c.documento,
                ...c.endereco,
              })
            }
          />
          <Button type="button" onClick={salvar}>
            Salvar cliente
          </Button>
        </div>
      )}
    </section>
  );
}

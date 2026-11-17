import { Input } from "./ui/input";
import { camposEndereco, modalidadesFrete, type DetalhesNota } from "@/lib/fiscal";

export function DadosFiscaisNota({
  dados,
  alterar,
  secao = "todos",
}: {
  dados: DetalhesNota;
  alterar: (d: DetalhesNota) => void;
  secao?: "todos" | "cliente" | "transporte" | "fisco";
}) {
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      {(secao === "todos" || secao === "cliente") && (
        <>
          <legend className="mb-2 font-semibold">Dados do destinatário</legend>
          <label>
            Destinatário
            <Input
              required
              value={dados.nome}
              onChange={(e) => alterar({ ...dados, nome: e.target.value })}
            />
          </label>
          <label>
            CPF ou CNPJ do destinatário
            <Input
              required
              maxLength={18}
              pattern={String.raw`(?:[0-9]{11}|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}|[A-Za-z0-9]{12}[0-9]{2}|[A-Za-z0-9]{2}\.[A-Za-z0-9]{3}\.[A-Za-z0-9]{3}\/[A-Za-z0-9]{4}-[0-9]{2})`}
              title="Informe o CPF ou CNPJ com ou sem pontuação."
              value={dados.documento}
              onChange={(e) => alterar({ ...dados, documento: e.target.value.toUpperCase() })}
            />
          </label>
          {(Object.keys(camposEndereco) as (keyof typeof camposEndereco)[]).map((campo) => (
            <label key={campo}>
              {camposEndereco[campo]}
              <Input
                required={campo !== "complemento"}
                maxLength={campo === "uf" ? 2 : campo === "cep" ? 9 : 120}
                pattern={
                  campo === "uf" ? "[A-Z]{2}" : campo === "cep" ? "[0-9]{5}-?[0-9]{3}" : undefined
                }
                value={dados.endereco[campo]}
                onChange={(e) =>
                  alterar({
                    ...dados,
                    endereco: {
                      ...dados.endereco,
                      [campo]: campo === "uf" ? e.target.value.toUpperCase() : e.target.value,
                    },
                  })
                }
              />
            </label>
          ))}
        </>
      )}
      {(secao === "todos" || secao === "transporte") && (
        <label className="sm:col-span-2">
          Modalidade do frete
          <select
            required
            className="block w-full rounded border bg-background p-2"
            value={dados.modFrete}
            onChange={(e) =>
              alterar({ ...dados, modFrete: e.target.value as DetalhesNota["modFrete"] })
            }
          >
            <option value="">Selecione a modalidade</option>
            {Object.entries(modalidadesFrete).map(([codigo, nome]) => (
              <option key={codigo} value={codigo}>
                {codigo} · {nome}
              </option>
            ))}
          </select>
        </label>
      )}
      {(secao === "todos" || secao === "fisco") && (
        <label className="sm:col-span-2">
          Informações adicionais de interesse do Fisco (opcional)
          <textarea
            className="block w-full rounded border bg-background p-2"
            rows={3}
            maxLength={2000}
            value={dados.infAdFisco}
            onChange={(e) => alterar({ ...dados, infAdFisco: e.target.value })}
          />
        </label>
      )}
    </fieldset>
  );
}

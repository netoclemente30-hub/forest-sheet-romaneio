import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { idRascunho, type Rascunho, type InutilizacaoRascunho } from "@/lib/fiscal";
const moeda = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function GerenciamentoFiscal({
  notas,
  abrir,
  copiar,
  nova,
  inutilizacoes,
  salvarInutilizacao,
}: {
  notas: Rascunho[];
  abrir: (id: string) => void;
  copiar: (r: Rascunho) => void;
  nova: () => void;
  inutilizacoes: InutilizacaoRascunho[];
  salvarInutilizacao: (r: InutilizacaoRascunho) => boolean;
}) {
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("");
  const [inutilizar, setInutilizar] = useState(false);
  const [erro, setErro] = useState("");
  const lista = notas.filter(
    (r) =>
      (
        r.carga.numero +
        " " +
        r.carga.cliente.nome +
        " " +
        r.carga.cliente.documento +
        " " +
        (r.detalhes?.cabecalho?.numero ?? "")
      )
        .toLowerCase()
        .includes(busca.toLowerCase()) &&
      (!situacao || String(r.assinado) === situacao),
  );
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Gerenciamento de NF-e</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setInutilizar(!inutilizar)}>
            Inutilizar numeração
          </Button>
          <Button onClick={nova}>Nova NF-e</Button>
        </div>
      </div>
      {inutilizar && (
        <form
          className="space-y-3 rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setErro("");
            const f = new FormData(e.currentTarget);
            const serie = Number(f.get("serie")),
              inicio = Number(f.get("inicio")),
              fim = Number(f.get("fim")),
              justificativa = String(f.get("justificativa") ?? "").trim();
            if (
              !Number.isInteger(serie) ||
              serie < 0 ||
              serie > 999 ||
              !Number.isInteger(inicio) ||
              inicio < 1 ||
              !Number.isInteger(fim) ||
              fim < inicio ||
              fim > 999999999 ||
              justificativa.length < 15
            ) {
              setErro("Confira série, intervalo e justificativa com pelo menos 15 caracteres.");
              return;
            }
            if (
              inutilizacoes.some((r) => r.serie === serie && inicio <= r.fim && fim >= r.inicio)
            ) {
              setErro("Já existe uma solicitação neste intervalo.");
              return;
            }
            if (salvarInutilizacao({ id: crypto.randomUUID(), serie, inicio, fim, justificativa }))
              setInutilizar(false);
          }}
        >
          <h3 className="font-semibold">Preparar inutilização de numeração</h3>
          <p>Solicitação em rascunho para revisão fiscal. Envio à Spedy pendente de aprovação.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["serie", "Série", 0, 999],
              ["inicio", "Número inicial", 1, 999999999],
              ["fim", "Número final", 1, 999999999],
            ].map(([nome, label, min, max]) => (
              <label key={nome}>
                {label}
                <Input name={String(nome)} type="number" min={min} max={max} step="1" required />
              </label>
            ))}
          </div>
          <label className="block">
            Justificativa
            <textarea
              name="justificativa"
              className="block w-full rounded border bg-background p-2"
              minLength={15}
              maxLength={255}
              required
            />
          </label>
          {erro && <p role="alert">{erro}</p>}
          <Button>Salvar solicitação em rascunho</Button>
        </form>
      )}
      <div className="flex flex-wrap gap-3">
        <label className="flex-1">
          Buscar notas
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Cliente, documento, número ou romaneio"
          />
        </label>
        <label>
          Situação
          <select
            className="block rounded border bg-background p-2"
            value={situacao}
            onChange={(e) => setSituacao(e.target.value)}
          >
            <option value="">Todas</option>
            <option value="false">Rascunho</option>
            <option value="true">Assinatura simulada</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted">
            <tr>
              {["Destinatário", "Romaneio / número", "Valor dos produtos", "Situação", "Ações"].map(
                (t) => (
                  <th className="p-3" key={t}>
                    {t}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {lista.map((r) => (
              <tr className="border-b" key={idRascunho(r)}>
                <td className="p-3">
                  <strong>{r.carga.cliente.nome}</strong>
                  <div>{r.carga.cliente.documento}</div>
                </td>
                <td className="p-3">
                  {r.carga.numero}
                  <div>
                    {r.origem.startsWith("serrada/") ? "Madeira serrada" : "Toras"} ·{" "}
                    {r.detalhes?.cabecalho?.numero || "Numeração pendente"} ·{" "}
                    {r.detalhes?.cabecalho?.tipo === "0" ? "Entrada" : "Saída"}
                  </div>
                </td>
                <td className="p-3 whitespace-nowrap">{moeda(r.total / 100)}</td>
                <td className="p-3">{r.assinado ? "Assinatura simulada" : "Rascunho"}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => abrir(idRascunho(r))}>
                      {r.carga.numero} · {r.assinado ? "Assinatura simulada" : "Rascunho"}
                    </Button>
                    <Button
                      variant="outline"
                      aria-label={"Copiar nota " + r.carga.numero}
                      onClick={() => copiar(r)}
                    >
                      Copiar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!notas.length && <p>Nenhum rascunho salvo.</p>}
      {!!notas.length && !lista.length && <p>Nenhuma nota corresponde à busca.</p>}
      {!!inutilizacoes.length && (
        <details>
          <summary>Solicitações de inutilização ({inutilizacoes.length})</summary>
          {inutilizacoes.map((r) => (
            <p key={r.id}>
              Série {r.serie} · {r.inicio} a {r.fim} · Rascunho · {r.justificativa}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}

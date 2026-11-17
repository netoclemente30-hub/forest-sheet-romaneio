import { useState, useSyncExternalStore } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { EVENTO_EMPRESA, getEmpresaAtiva } from "@/lib/empresa";
import { cnpjValido } from "@/lib/cnpj";
import { cargasFiscais, importarCarga } from "@/lib/fiscal-cargas";
import {
  chaveFiscal,
  contaNova,
  montarRascunho,
  type ContaFiscal,
  type Rascunho,
} from "@/lib/fiscal";
import { verificarSpedy } from "@/lib/spedy.functions";
import type { DadosNfe } from "@/lib/nfe-txt";

export const Route = createFileRoute("/fiscal")({
  staticData: { sitemap: false },
  component: Fiscal,
});
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const painel = "space-y-3 rounded-xl border bg-card p-4";
const ouvir = (fn: () => void) => {
  window.addEventListener(EVENTO_EMPRESA, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENTO_EMPRESA, fn);
    window.removeEventListener("storage", fn);
  };
};
function Fiscal() {
  const { session, empresaId, isSuperAdmin, papel, permissoesCarregando } = useAuth();
  const ativa = useSyncExternalStore(ouvir, getEmpresaAtiva, () => null);
  const empresa = isSuperAdmin ? ativa || empresaId : empresaId;
  if (permissoesCarregando) return <p>Carregando empresa…</p>;
  if (!session || !["superadmin", "admin_empresa"].includes(papel))
    return <p>Acesso fiscal restrito à administração.</p>;
  if (!empresa) return <p>Selecione a empresa para abrir o Fiscal.</p>;
  const chave = chaveFiscal(session.user.id, empresa);
  return <Painel key={chave} empresa={empresa} chave={chave} />;
}
function Painel({ empresa, chave }: { empresa: string; chave: string }) {
  const [conta, setConta] = useState<ContaFiscal>(
    () => JSON.parse(sessionStorage.getItem(chave) || "null") ?? contaNova(),
  );
  const [cadastro, setCadastro] = useState(conta.cadastro);
  const [origem, setOrigem] = useState("");
  const [aberto, setAberto] = useState("");
  const [conexao, setConexao] = useState("");
  const cargas = useQuery({
    queryKey: ["cargas-fiscais", empresa],
    queryFn: () => cargasFiscais(empresa),
  });
  const carga = useQuery({
    queryKey: ["carga-fiscal", empresa, origem],
    queryFn: () => importarCarga(empresa, origem),
    enabled: !!origem,
  });
  const previa = conta.historico.find((r) => r.origem === aberto);
  function salvar(proxima: ContaFiscal) {
    try {
      sessionStorage.setItem(chave, JSON.stringify(proxima));
      setConta(proxima);
      return true;
    } catch {
      toast.error("Falha ao salvar nesta aba.");
      return false;
    }
  }
  async function testar() {
    setConexao("Consultando…");
    try {
      setConexao(await verificarSpedy({ data: { empresa } }));
    } catch {
      setConexao("Não foi possível verificar a conexão da empresa.");
    }
  }
  return (
    <main className="space-y-4">
      <h1 className="text-3xl font-bold">Fiscal</h1>
      <p>
        Homologação Spedy · Rascunhos sem valor fiscal. Cadastro e histórico ficam nesta aba durante
        a sessão.
      </p>
      <section className={painel}>
        <h2 className="text-xl font-bold">Emitente</h2>
        <small>Empresa do Gestor · {empresa}</small>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!cnpjValido(cadastro.cnpj) || !cadastro.nome.trim() || !cadastro.ie.trim()) {
              toast.error("Confira a razão social, o CNPJ e a inscrição estadual.");
              return;
            }
            if (salvar({ ...conta, cadastro })) toast.success("Cadastro fiscal salvo.");
          }}
        >
          {(
            [
              ["nome", "Razão social"],
              ["cnpj", "CNPJ"],
              ["ie", "Inscrição estadual"],
            ] as const
          ).map(([campo, label]) => (
            <label key={campo}>
              {label}
              <Input
                required
                maxLength={campo === "cnpj" ? 18 : 120}
                value={cadastro[campo]}
                onChange={(e) => setCadastro({ ...cadastro, [campo]: e.target.value })}
              />
            </label>
          ))}
          <Button>Salvar cadastro</Button>
        </form>
        <p>Assinatura do módulo · {conta.assinatura ? "Ativa em simulação" : "Inativa"}</p>
        <Button
          variant="outline"
          onClick={() => salvar({ ...conta, assinatura: !conta.assinatura })}
        >
          {conta.assinatura ? "Suspender simulação" : "Simular contratação"}
        </Button>
        <Button variant="outline" disabled={conexao === "Consultando…"} onClick={testar}>
          Verificar conexão Spedy
        </Button>
        <p role="status">{conexao}</p>
      </section>
      <section className={painel}>
        <h2 className="text-xl font-bold">Preparar NF-e</h2>
        <label>
          Romaneio
          <select
            className="block w-full rounded border p-2"
            value={origem}
            onChange={(e) => {
              setOrigem(e.target.value);
              setAberto("");
            }}
          >
            <option value="">Selecione a carga</option>
            {cargas.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        {cargas.isLoading && <p>Carregando romaneios…</p>}
        {cargas.data?.length === 0 && <p>Nenhum romaneio nesta empresa.</p>}
        {(cargas.isError || carga.isError) && (
          <p role="alert">Falha ao carregar o romaneio. Confira a conexão e os itens da carga.</p>
        )}
        {origem && carga.isLoading && <p>Carregando itens…</p>}
        {carga.data && (
          <Editor
            key={origem}
            carga={carga.data}
            habilitado={conta.assinatura && !!conta.cadastro.nome}
            gerar={(cliente, precos) => {
              try {
                const r = montarRascunho(conta.cadastro, carga.data, origem, cliente, precos);
                if (
                  salvar({
                    ...conta,
                    historico: [r, ...conta.historico.filter((i) => i.origem !== origem)],
                  })
                )
                  setAberto(origem);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            existente={conta.historico.some((d) => d.origem === origem)}
            abrir={() => setAberto(origem)}
          />
        )}
      </section>
      {previa && (
        <section className={painel}>
          <Previa r={previa} />
          {!previa.assinado && (
            <Button
              disabled={!conta.assinatura}
              onClick={() =>
                salvar({
                  ...conta,
                  historico: conta.historico.map((d) =>
                    d === previa ? { ...d, assinado: true } : d,
                  ),
                })
              }
            >
              Simular assinatura digital
            </Button>
          )}
        </section>
      )}
      <section className={painel}>
        <h2 className="text-xl font-bold">Histórico fiscal da sessão</h2>
        {!conta.historico.length && <p>Nenhum rascunho salvo.</p>}
        {conta.historico.map((r) => (
          <Button
            className="block"
            variant="outline"
            key={r.origem}
            onClick={() => setAberto(r.origem)}
          >
            {r.carga.numero} · {r.assinado ? "Assinatura simulada" : "Rascunho"}
          </Button>
        ))}
      </section>
    </main>
  );
}
function Editor({
  carga,
  habilitado,
  gerar,
  existente,
  abrir,
}: {
  carga: DadosNfe;
  habilitado: boolean;
  gerar: (cliente: string, precos: string[]) => void;
  existente: boolean;
  abrir: () => void;
}) {
  const [cliente, setCliente] = useState(carga.cliente?.nome || "");
  const [precos, setPrecos] = useState(carga.itens.map(() => ""));
  if (existente) return <Button onClick={abrir}>Abrir rascunho existente</Button>;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        gerar(cliente, precos);
      }}
    >
      <label>
        Destinatário
        <Input
          required
          value={cliente}
          readOnly={!!carga.cliente?.nome}
          onChange={(e) => setCliente(e.target.value)}
        />
      </label>
      {carga.itens.map((i, n) => (
        <label className="block" key={i.descricao}>
          {i.descricao} · {i.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} m³ ·
          Preço por m³ (R$)
          <Input
            required
            inputMode="decimal"
            value={precos[n]}
            onChange={(e) => setPrecos(precos.map((p, j) => (j === n ? e.target.value : p)))}
          />
        </label>
      ))}
      {!habilitado && <p>Salve o cadastro e ative a assinatura simulada para criar o rascunho.</p>}
      <Button disabled={!habilitado || !carga.itens.length}>Gerar prévia e salvar rascunho</Button>
    </form>
  );
}
function Previa({ r }: { r: Rascunho }) {
  return (
    <>
      <h2 className="text-xl font-bold">
        Prévia da NF-e · {r.assinado ? "Assinatura simulada" : "Rascunho"}
      </h2>
      <p>
        {r.cadastro.nome} · CNPJ {r.cadastro.cnpj} · IE {r.cadastro.ie}
      </p>
      <p>
        Destinatário · {r.carga.cliente.nome} {r.carga.cliente.documento}
      </p>
      <p>
        Romaneio {r.carga.numero} · {r.carga.data} · {r.carga.motorista?.nome} · {r.carga.placa}{" "}
        {r.carga.reboque}
      </p>
      <ul>
        {r.itens.map((i) => (
          <li key={i.descricao}>
            {i.descricao} · NCM {i.ncm} ·{" "}
            {i.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} m³ ×{" "}
            {moeda(i.preco)} = {moeda(i.centavos / 100)}
          </li>
        ))}
      </ul>
      <strong>Total dos produtos · {moeda(r.total / 100)}</strong>
      <p>CFOP, classificação e tributos pendentes de conferência fiscal.</p>
    </>
  );
}

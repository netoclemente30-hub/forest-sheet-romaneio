import { useEffect, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { capturarLog, gravarRegistro } from "@/lib/registro";
import { cargaManual, itemDoCadastro } from "@/lib/fiscal-manual";
import { hojeLocal } from "@/lib/nfe-txt";
import { CadastrosFiscais } from "@/components/CatalogoFiscal";
import { EventosNfe } from "@/components/EventosNfe";
import { GerenciamentoFiscal } from "@/components/GerenciamentoFiscal";
import { ConsultaCnpjFiscal } from "@/components/ConsultaCnpjFiscal";
import { OnboardingSpedy } from "@/components/OnboardingSpedy";
import {
  documentoId,
  lerCatalogo,
  type CatalogoFiscal,
  type ProdutoFiscal,
  type ClienteFiscal,
} from "@/lib/catalogo-fiscal";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DadosFiscaisNota } from "@/components/DadosFiscaisNota";
import { useAuth } from "@/hooks/useAuth";
import { EVENTO_EMPRESA, getEmpresaAtiva } from "@/lib/empresa";
import { cnpjValido } from "@/lib/cnpj";
import { ContadorFiscal } from "@/components/ContadorFiscal";
import { cargasFiscais, importarCarga } from "@/lib/fiscal-cargas";
import {
  chaveFiscal,
  idRascunho,
  copiarRascunho,
  detalhesIniciais,
  modalidadesFrete,
  camposEndereco,
  type DetalhesNota,
  contaNova,
  montarRascunho,
  type ContaFiscal,
  type Cadastro,
  type Rascunho,
} from "@/lib/fiscal";
import { verificarSpedy } from "@/lib/spedy.functions";
import { DiagnosticoSpedy, EmissaoHomologacao, InutilizacaoHomologacao } from "@/components/HomologacaoSpedy";
import type { DadosNfe } from "@/lib/nfe-txt";

export const Route = createFileRoute("/fiscal")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: 'Fiscal — Gestor Florestal' },
    { name: 'description', content: 'Cadastros e rascunhos fiscais por empresa no Gestor Florestal.' },
    { property: 'og:title', content: 'Fiscal — Gestor Florestal' },
    { property: 'og:description', content: 'Cadastros e rascunhos fiscais por empresa no Gestor Florestal.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
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
  if (!session || !["superadmin", "admin_empresa", "gerente_escritorio"].includes(papel))
    return <p>Acesso fiscal restrito à administração.</p>;
  if (!empresa) return <p>Selecione a empresa para abrir o Fiscal.</p>;
  const chave = chaveFiscal(session.user.id, empresa);
  return <Painel key={chave} empresa={empresa} chave={chave} />;
}
function Painel({ empresa, chave }: { empresa: string; chave: string }) {
  const [conta, setConta] = useState<ContaFiscal>(() => {
    const sessao: ContaFiscal = JSON.parse(localStorage.getItem(chave + ':rascunhos') || sessionStorage.getItem(chave) || "null") ?? contaNova();
    return {
      ...sessao,
      cadastro: JSON.parse(localStorage.getItem(chave + ":emitente") || "null") ?? sessao.cadastro,
    };
  });
  const [cadastro, setCadastro] = useState(conta.cadastro);
  const [emitenteAberto, setEmitenteAberto] = useState(!conta.cadastro.nome);
  const [carregandoEmitente, setCarregandoEmitente] = useState(true);
  const [salvandoEmitente, setSalvandoEmitente] = useState(false);
  useEffect(() => {
    let ativo = true;
    void supabase.from("empresa_emitente").select("cadastro").eq("empresa_id", empresa).maybeSingle().then(({ data, error }) => {
      if (!ativo) return;
      if (error) toast.error("Não foi possível carregar o emitente salvo. Confira a conexão.");
      else if (data?.cadastro && typeof data.cadastro === "object" && !Array.isArray(data.cadastro)) {
        const salvo = data.cadastro as unknown as Cadastro;
        if (salvo.nome && salvo.cnpj && salvo.ie) {
          setCadastro(salvo);
          setConta((atual) => ({ ...atual, cadastro: salvo }));
          setEmitenteAberto(false);
        }
      }
      setCarregandoEmitente(false);
    });
    return () => { ativo = false; };
  }, [empresa]);
  const prefixo = chave + ":cadastros:";
  const [catalogo, setCatalogo] = useState(() => lerCatalogo(prefixo));
  const [mostrarCadastros, setMostrarCadastros] = useState(false);
  const [buscarEmitente, setBuscarEmitente] = useState("");
  useEffect(() => {
    const atualizar = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith(prefixo)) setCatalogo(lerCatalogo(prefixo));
    };
    window.addEventListener("storage", atualizar);
    return () => window.removeEventListener("storage", atualizar);
  }, [prefixo]);
  function gravar(
    tipo: "cliente" | "produto",
    id: string,
    registro: ClienteFiscal | ProdutoFiscal,
  ) {
    try {
      localStorage.setItem(prefixo + tipo + ":" + id, JSON.stringify(registro));
      setCatalogo(lerCatalogo(prefixo));
      toast.success("Cadastro salvo.");
      return true;
    } catch {
      toast.error("Falha ao salvar cadastro neste navegador.");
      return false;
    }
  }
  const [origem, setOrigem] = useState("");
  const [manualId, setManualId] = useState(() => "manual:" + crypto.randomUUID());
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
  const previa = conta.historico.find((r) => idRascunho(r) === aberto);
  function salvar(proxima: ContaFiscal) {
    try {
      localStorage.setItem(chave + ':rascunhos', JSON.stringify(proxima));
      setConta(proxima);
      return true;
    } catch {
      toast.error("Falha ao guardar o rascunho neste aparelho.");
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
      <Button
        variant="outline"
        aria-expanded={mostrarCadastros}
        onClick={() => setMostrarCadastros(!mostrarCadastros)}
      >
        Cadastros de clientes e produtos
      </Button>
      {mostrarCadastros && <CadastrosFiscais catalogo={catalogo} gravar={gravar} />}
      <p>
        Homologação Spedy · Rascunhos sem valor fiscal. Clientes e produtos ficam neste navegador. O
        histórico de rascunhos fica neste aparelho. Emissão e consulta fiscal exigem internet.
      </p>
      <GerenciamentoFiscal
        notas={conta.historico}
        abrir={setAberto}
        copiar={(r) => {
          const copia = copiarRascunho(r);
          if (salvar({ ...conta, historico: [copia, ...conta.historico] })) {
            setAberto(idRascunho(copia));
            toast.success("Cópia criada para edição.");
          }
        }}
        nova={() => {
          setAberto("");
          setOrigem("");
          setManualId("manual:" + crypto.randomUUID());
          document
            .getElementById("preparar-nfe")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        inutilizacoes={conta.inutilizacoes ?? []}
        salvarInutilizacao={(r) =>
          salvar({ ...conta, inutilizacoes: [r, ...(conta.inutilizacoes ?? [])] })
        }
      />
      <ContadorFiscal empresa={empresa} />
      <InutilizacaoHomologacao empresa={empresa} cadastro={conta.cadastro} itens={conta.inutilizacoes ?? []} />
      <section className={painel}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold">Emitente</h2>
          <Button variant="ghost" size="icon" aria-label={emitenteAberto ? "Minimizar emitente" : "Expandir emitente"} aria-expanded={emitenteAberto} onClick={() => setEmitenteAberto(!emitenteAberto)}>{emitenteAberto ? <ChevronUp /> : <ChevronDown />}</Button>
        </div>
        {!emitenteAberto && <p className="break-words text-sm text-muted-foreground">{carregandoEmitente ? "Carregando emitente…" : `${conta.cadastro.nome} · ${conta.cadastro.cnpj}`}</p>}
        <div hidden={!emitenteAberto} className="space-y-3">
        <DiagnosticoSpedy empresa={empresa} cnpj={conta.cadastro.cnpj} />
        <small>Empresa do Gestor · {empresa}</small>
        <OnboardingSpedy empresa={empresa} cadastro={conta.cadastro} />
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (carregandoEmitente || salvandoEmitente) return;
            if (!cnpjValido(cadastro.cnpj) || !cadastro.nome.trim() || !cadastro.ie.trim()) {
              toast.error("Confira a razão social, o CNPJ e a inscrição estadual.");
              return;
            }
            setSalvandoEmitente(true);
            try {
              const log = await capturarLog("Cadastro fiscal do emitente", "Atualização do emitente da empresa");
              const { error } = await supabase.from("empresa_emitente").upsert({ empresa_id: empresa, cadastro: cadastro as unknown as Json, atualizado_em: new Date().toISOString() });
              if (error) throw error;
              setConta((atual) => ({ ...atual, cadastro }));
              setEmitenteAberto(false);
              try { localStorage.setItem(chave + ":emitente", JSON.stringify(cadastro)); } catch { /* A nuvem preserva o cadastro. */ }
              try { await gravarRegistro(log, empresa); } catch { toast.warning("Emitente salvo, mas não foi possível registrar a atividade."); }
              toast.success("Emitente salvo para as próximas notas.");
            } catch {
              toast.error("Não foi possível salvar o emitente. Confira a conexão e tente novamente.");
            } finally { setSalvandoEmitente(false); }
          }}
        >
          {(
            [
              ["cnpj", "CNPJ"],
              ["nome", "Razão social"],
              ["ie", "Inscrição estadual"],
            ] as const
          ).map(([campo, label]) => (
            <label key={campo}>
              {label}
              <Input
                required
                maxLength={campo === "cnpj" ? 18 : 120}
                value={cadastro[campo]}
                onChange={(e) => {
                  if (campo === "cnpj") setBuscarEmitente(e.target.value);
                  setCadastro({ ...cadastro, [campo]: e.target.value });
                }}
              />
            </label>
          ))}
          <ConsultaCnpjFiscal
            documento={buscarEmitente}
            aplicar={(c) =>
              setCadastro((atual) => ({ ...atual, nome: c.nome, endereco: c.endereco }))
            }
          />
          <details open={!!cadastro.endereco}>
            <summary>Endereço do emitente</summary>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(camposEndereco) as (keyof typeof camposEndereco)[]).map((k) => (
                <label key={k}>
                  {camposEndereco[k]} do emitente
                  <Input
                    value={cadastro.endereco?.[k] ?? ""}
                    onChange={(e) =>
                      setCadastro({
                        ...cadastro,
                        endereco: {
                          ...detalhesIniciais({ numero: "", data: "", itens: [] }).endereco,
                          ...cadastro.endereco,
                          [k]: e.target.value,
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </details>
          <Button disabled={carregandoEmitente || salvandoEmitente}>{salvandoEmitente ? "Salvando…" : "Salvar cadastro"}</Button>
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
        </div>
      </section>
      <section className={painel} id="preparar-nfe">
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
            <option value="">Sem romaneio · adicionar itens</option>
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
        {(!origem || carga.data) && (
          <Editor
            key={origem || manualId}
            manual={!origem}
            carga={origem && carga.data ? carga.data : cargaManual(hojeLocal())}
            catalogo={catalogo}
            habilitado={!carregandoEmitente && conta.assinatura && !!conta.cadastro.nome}
            gerar={(cliente, precos, fiscais, dadosCarga) => {
              try {
                const r = montarRascunho(
                  conta.cadastro,
                  dadosCarga,
                  origem || manualId,
                  cliente,
                  precos,
                  fiscais,
                );
                if (
                  salvar({
                    ...conta,
                    historico: [r, ...conta.historico],
                  })
                )
                  setAberto(origem || manualId);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            existente={conta.historico.some((d) => d.origem === (origem || manualId))}
            abrir={() => {
              const r = conta.historico.find((r) => r.origem === (origem || manualId));
              if (r) setAberto(idRascunho(r));
            }}
          />
        )}
      </section>
      {previa && (
        <section className={painel}>
          <Previa r={previa} />
          <EditarDadosNota
            key={idRascunho(previa)}
            r={previa}
            catalogo={catalogo}
            habilitado={conta.assinatura}
            salvarDados={(detalhes, precos, fiscais, dadosCarga) => {
              const atualizado = {
                ...previa,
                ...(previa.itens.length
                  ? montarRascunho(
                      previa.cadastro,
                      dadosCarga,
                      previa.origem,
                      detalhes,
                      precos,
                      fiscais,
                    )
                  : {}),
                criado: previa.criado,
                detalhes,
                assinado: false,
                carga: {
                  ...dadosCarga,
                  cliente: { nome: detalhes.nome.trim(), documento: detalhes.documento.trim() },
                },
              };
              return salvar({
                ...conta,
                historico: conta.historico.map((r) => (r === previa ? atualizado : r)),
              });
            }}
          />
          {!previa.assinado && (
            <Button
              disabled={!conta.assinatura || !previa.detalhes}
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
          {previa.detalhes && <EmissaoHomologacao empresa={empresa} r={previa} />}
          <EventosNfe key={empresa+":"+idRascunho(previa)} empresa={empresa} rascunhoId={idRascunho(previa)}/>
          <Button
            variant="destructive"
            onClick={() => {
              if (!window.confirm("Excluir este rascunho deste aparelho? Notas já enviadas em homologação continuam registradas no servidor.")) return;
              if (salvar({ ...conta, historico: conta.historico.filter((r) => r !== previa) })) {
                setAberto("");
                toast.success("Rascunho excluído.");
              }
            }}
          >
            Excluir rascunho
          </Button>
        </section>
      )}
    </main>
  );
}
function Editor({
  carga,
  habilitado,
  gerar,
  existente,
  catalogo,
  abrir,
  anterior,
  cancelar,
  manual = false,
}: {
  carga: DadosNfe;
  habilitado: boolean;
  gerar: (cliente: DetalhesNota, precos: string[], fiscais: ProdutoFiscal[], carga: DadosNfe) => void;
  catalogo: CatalogoFiscal;
  existente: boolean;
  abrir: () => void;
  anterior?: Rascunho;
  cancelar?: () => void;
  manual?: boolean;
}) {
  const [cliente, setCliente] = useState(() =>
    anterior
      ? (anterior.detalhes ?? detalhesIniciais(anterior.carga))
      : {
          ...detalhesIniciais(carga),
          ...catalogo.clientes.find(
            (c) => documentoId(c.documento) === documentoId(carga.cliente?.documento ?? ""),
          ),
        },
  );
  const [itens, setItens] = useState(carga.itens);
  const dadosCarga = { ...carga, itens };
  const [aba, setAba] = useState("Cabeçalho");
  const [buscarCliente, setBuscarCliente] = useState("");
  const [produtos, setProdutos] = useState(() =>
    carga.itens.map((i, index) => {
      const salvo = anterior?.itens[index];
      if (salvo)
        return {
          codigo: salvo.codigo,
          descricao: salvo.descricao,
          ncm: salvo.ncm,
          cfop: salvo.cfop ?? "",
          preco: String(salvo.preco),
        };
      const p = catalogo.produtos.find((p) => p.codigo === i.codigo && p.descricao === i.descricao);
      return p ?? { codigo: i.codigo, descricao: i.descricao, ncm: i.ncm, cfop: "", preco: "" };
    }),
  );
  function atualizar(index: number, produto: ProdutoFiscal) {
    setProdutos((ps) => ps.map((p, n) => (n === index ? produto : p)));
  }
  if (existente) return <Button onClick={abrir}>Abrir rascunho existente</Button>;
  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const invalido = e.currentTarget.querySelector<HTMLInputElement>(
          ":is(input,select,textarea):invalid",
        );
        if (invalido) {
          const secao = invalido.closest<HTMLElement>("[data-aba]")?.dataset["aba"];
          if (secao) setAba(secao);
          requestAnimationFrame(() => {
            invalido.focus();
            invalido.reportValidity();
          });
          return;
        }
        gerar(
          cliente,
          produtos.map((p) => p.preco),
          produtos,
          dadosCarga,
        );
      }}
    >
      <div className="flex flex-wrap gap-2">
        {["Cabeçalho", "Cliente", "Produtos", "Totais", "Transporte", "Fisco"].map((a) => (
          <Button
            type="button"
            key={a}
            aria-pressed={aba === a}
            variant={aba === a ? "default" : "outline"}
            onClick={() => setAba(a)}
          >
            {a}
          </Button>
        ))}
      </div>
      <div hidden={aba !== "Cabeçalho"} data-aba="Cabeçalho" className="grid gap-3 sm:grid-cols-2">
        <p>Modelo 55 · Homologação{manual ? " · Sem romaneio" : ` · Romaneio ${carga.numero}`}</p>
        <label>
          Tipo da nota
          <select
            className="block w-full rounded border bg-background p-2"
            value={cliente.cabecalho?.tipo ?? "1"}
            onChange={(e) =>
              setCliente({
                ...cliente,
                cabecalho: {
                  natureza: carga.natureza ?? "",
                  serie: "",
                  numero: "",
                  finalidade: "1",
                  ...cliente.cabecalho,
                  tipo: e.target.value as "0" | "1",
                },
              })
            }
          >
            <option value="0">0 · Entrada</option>
            <option value="1">1 · Saída</option>
          </select>
        </label>
        {(
          [
            ["natureza", "Natureza da operação"],
            ["serie", "Série"],
            ["numero", "Número da NF-e para revisão"],
          ] as const
        ).map(([k, label]) => (
          <label key={k}>
            {label}
            <Input
              value={cliente.cabecalho?.[k] ?? (k === "natureza" ? (carga.natureza ?? "") : "")}
              maxLength={k === "serie" ? 3 : k === "numero" ? 9 : 60}
              pattern={k === "natureza" ? undefined : "[0-9]*"}
              onChange={(e) =>
                setCliente({
                  ...cliente,
                  cabecalho: {
                    natureza: carga.natureza ?? "",
                    serie: "",
                    numero: "",
                    finalidade: "1",
                    ...cliente.cabecalho,
                    [k]: e.target.value,
                  },
                })
              }
            />
          </label>
        ))}
        <label>
          Finalidade
          <select
            className="block w-full rounded border bg-background p-2"
            value={cliente.cabecalho?.finalidade ?? "1"}
            onChange={(e) =>
              setCliente({
                ...cliente,
                cabecalho: {
                  natureza: carga.natureza ?? "",
                  serie: "",
                  numero: "",
                  ...cliente.cabecalho,
                  finalidade: e.target.value,
                },
              })
            }
          >
            {["Normal", "Complementar", "Ajuste", "Devolução"].map((f, n) => (
              <option key={f} value={String(n + 1)}>
                {f}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div hidden={aba !== "Totais"} data-aba="Totais" className="space-y-3">
        <p>
          Quantidade dos itens ·{" "}
          {itens
            .reduce((s, i) => s + i.quantidade, 0)
            .toLocaleString("pt-BR", { maximumFractionDigits: 4 })}{" "}
          m³
        </p>
        <p>
          Soma dos produtos preenchidos ·{" "}
          {moeda(
            itens.reduce(
              (s, i, n) =>
                s +
                Math.round(
                  i.quantidade * (Number(produtos[n]?.preco.replace(",", ".")) || 0) * 100,
                ),
              0,
            ) / 100,
          )}
        </p>
        <p>
          Impostos, frete cobrado e demais valores dependem de conferência para compor o total
          fiscal.
        </p>
      </div>
      <div hidden={aba !== "Cliente"} data-aba="Cliente">
        <label>
          Buscar cliente cadastrado
          <select
            className="block w-full rounded border bg-background p-2"
            value={
              catalogo.clientes.find(
                (c) => documentoId(c.documento) === documentoId(cliente.documento),
              )?.documento ?? ""
            }
            onChange={(e) => {
              setBuscarCliente("");
              const c = catalogo.clientes.find((c) => c.documento === e.target.value);
              setCliente({
                ...cliente,
                ...(c ?? detalhesIniciais(carga)),
                modFrete: cliente.modFrete,
                infAdFisco: cliente.infAdFisco,
              });
            }}
          >
            <option value="">Preencher destinatário</option>
            {catalogo.clientes.map((c) => (
              <option key={c.documento} value={c.documento}>
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
              const salvo = catalogo.clientes.find(
                (c) => documentoId(c.documento) === documentoId(d.documento),
              );
              setBuscarCliente(salvo ? "" : d.documento);
              if (salvo) {
                setCliente({ ...d, ...salvo });
                return;
              }
            }
            setCliente(d);
          }}
        />
        <ConsultaCnpjFiscal
          documento={buscarCliente}
          aplicar={(c) => setCliente((d) => ({ ...d, ...c }))}
        />
      </div>
      <div hidden={aba !== "Transporte"} data-aba="Transporte">
        <p>
          Motorista · {carga.motorista?.nome || "Não informado"} {carga.motorista?.cpf}
        </p>
        <p>
          Veículo · {carga.placa || "Não informado"} {carga.reboque}
        </p>
        <DadosFiscaisNota secao="transporte" dados={cliente} alterar={setCliente} />
      </div>
      <div hidden={aba !== "Fisco"} data-aba="Fisco">
        <DadosFiscaisNota secao="fisco" dados={cliente} alterar={setCliente} />
      </div>
      <div hidden={aba !== "Produtos"} data-aba="Produtos">
        {manual && <Button type="button" variant="outline" onClick={() => { setItens((atual) => [...atual, itemDoCadastro()]); setProdutos((atual) => [...atual, { codigo: "", descricao: "", ncm: "", cfop: "", preco: "" }]); }}><Plus /> Adicionar item</Button>}
        {itens.map((i, n) => (
          <fieldset className="mb-3 space-y-2 rounded border p-3" key={n}>
            <legend>{i.descricao || `Item ${n + 1}`}</legend>
            <label>
              Produto cadastrado
              <select
                className="block w-full rounded border bg-background p-2"
                value={
                  catalogo.produtos.find((p) => p.codigo === produtos[n]?.codigo)?.codigo ?? ""
                }
                onChange={(e) => {
                  const p = catalogo.produtos.find((p) => p.codigo === e.target.value);
                  atualizar(n, p ?? { ...i, cfop: "", preco: "" });
                  if (manual && p) setItens((atual) => atual.map((item, index) => index === n ? { ...itemDoCadastro(p), quantidade: item.quantidade } : item));
                }}
              >
                <option value="">{manual ? "Preencher item manualmente" : "Usar item do romaneio"}</option>
                {catalogo.produtos.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.codigo} · {p.descricao}
                  </option>
                ))}
              </select>
            </label>
            {manual && <div className="grid gap-2 sm:grid-cols-2">
              {(["codigo", "descricao", "unidade"] as const).map((campo) => <label key={campo}>{campo === "codigo" ? "Código do item" : campo === "descricao" ? "Descrição do item" : "Unidade"}<Input required value={campo === "unidade" ? i.unidade : produtos[n]?.[campo] ?? ""} onChange={(e) => {
                const valor = campo === "unidade" ? e.target.value.toUpperCase() : e.target.value;
                setItens((atual) => atual.map((item, index) => index === n ? { ...item, [campo]: valor } : item));
                const produto = produtos[n];
                if (produto) atualizar(n, { ...produto, [campo]: valor });
              }} /></label>)}
              <label>Quantidade<Input required type="number" min="0.0001" step="0.0001" value={i.quantidade || ""} onChange={(e) => setItens((atual) => atual.map((item, index) => index === n ? { ...item, quantidade: Number(e.target.value) } : item))} /></label>
            </div>}
            {(["ncm", "cfop"] as const).map((k) => (
              <label key={k}>
                {k.toUpperCase()} da operação
                <Input
                  pattern={k === "ncm" ? "[0-9]{8}" : "[0-9]{4}"}
                  value={produtos[n]?.[k] ?? ""}
                  onChange={(e) => { const produto = produtos[n]; if (produto) atualizar(n, { ...produto, [k]: e.target.value }); }}
                />
              </label>
            ))}
            <label className="block" key={n}>
              {i.descricao} · {i.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}{" "}
              {i.unidade} · Preço por unidade (R$)
              <Input
                required
                inputMode="decimal"
                value={produtos[n]?.preco ?? ""}
                onChange={(e) => { const produto = produtos[n]; if (produto) atualizar(n, { ...produto, preco: e.target.value }); }}
              />
            </label>
            {manual && <Button type="button" size="icon" variant="ghost" aria-label={`Remover item ${n + 1}`} onClick={() => { setItens((atual) => atual.filter((_, index) => index !== n)); setProdutos((atual) => atual.filter((_, index) => index !== n)); }}><Trash2 /></Button>}
          </fieldset>
        ))}
      </div>
      {!habilitado && <p>Salve o cadastro e ative a assinatura simulada para criar o rascunho.</p>}
      {anterior?.assinado && <p>Ao salvar as alterações, a nota volta ao estado de rascunho.</p>}
      <Button disabled={!habilitado || !itens.length}>
        {anterior ? "Salvar alterações" : "Gerar prévia e salvar rascunho"}
      </Button>
      {cancelar && (
        <Button type="button" variant="outline" onClick={cancelar}>
          Cancelar
        </Button>
      )}
    </form>
  );
}
function EditarDadosNota({
  r,
  habilitado,
  salvarDados,
  catalogo,
}: {
  r: Rascunho;
  habilitado: boolean;
  salvarDados: (d: DetalhesNota, precos: string[], fiscais: ProdutoFiscal[], carga: DadosNfe) => boolean;
  catalogo: CatalogoFiscal;
}) {
  const [edicao, setEdicao] = useState<DetalhesNota | null>(null);
  if (!edicao)
    return (
      <Button
        variant="outline"
        disabled={!habilitado}
        onClick={() => setEdicao(r.detalhes ?? detalhesIniciais(r.carga))}
      >
        Editar dados da nota
      </Button>
    );
  return (
    <Editor
      carga={r.carga}
      manual={r.origem.startsWith("manual:")}
      catalogo={catalogo}
      anterior={r}
      habilitado={habilitado}
      existente={false}
      abrir={() => {}}
      cancelar={() => setEdicao(null)}
      gerar={(d, precos, fiscais, carga) => {
        try {
          if (habilitado && salvarDados(d, precos, fiscais, carga)) setEdicao(null);
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}
    />
  );
}
function Previa({ r }: { r: Rascunho }) {
  const endereco = r.detalhes?.endereco;
  return (
    <>
      <h2 className="text-xl font-bold">
        Prévia da NF-e · {r.assinado ? "Assinatura simulada" : "Rascunho"}
      </h2>
      <p>
        Modelo 55 · {r.detalhes?.cabecalho?.tipo === "0" ? "Entrada" : "Saída"} · Série{" "}
        {r.detalhes?.cabecalho?.serie || "Pendente"} · Número{" "}
        {r.detalhes?.cabecalho?.numero || "Pendente"} ·{" "}
        {r.detalhes?.cabecalho?.natureza || r.carga.natureza || "Natureza da operação pendente"}
      </p>
      <p>
        {r.cadastro.nome} · CNPJ {r.cadastro.cnpj} · IE {r.cadastro.ie}
      </p>
      {r.cadastro.endereco && (
        <p>
          Endereço do emitente · {Object.values(r.cadastro.endereco).filter(Boolean).join(", ")}
        </p>
      )}
      <p>Destinatário · {r.carga.cliente.nome}</p>
      <p>CPF ou CNPJ · {r.carga.cliente.documento || "Pendente"}</p>
      <p>
        Endereço ·{" "}
        {endereco
          ? [
              endereco.logradouro,
              endereco.numero,
              endereco.complemento,
              endereco.bairro,
              endereco.municipio,
              endereco.uf,
              "CEP " + endereco.cep,
            ]
              .filter(Boolean)
              .join(", ")
          : "Pendente"}
      </p>
      <p>
        Modalidade do frete ·{" "}
        {r.detalhes?.modFrete ? modalidadesFrete[r.detalhes.modFrete] : "Pendente"}
      </p>
      <p className="whitespace-pre-wrap">
        Informações adicionais de interesse do Fisco · {r.detalhes?.infAdFisco || "Não informadas"}
      </p>
      <p>
        Romaneio {r.carga.numero} · {r.carga.data} · {r.carga.motorista?.nome} · {r.carga.placa}{" "}
        {r.carga.reboque}
      </p>
      <ul>
        {r.itens.map((i) => (
          <li key={i.codigo + "-" + r.itens.indexOf(i)}>
            {i.descricao} · NCM {i.ncm} · CFOP {i.cfop || "Pendente"} ·{" "}
            {i.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} {i.unidade} ×{" "}
            {moeda(i.preco)} = {moeda(i.centavos / 100)}
          </li>
        ))}
      </ul>
      <strong>Total dos produtos · {moeda(r.total / 100)}</strong>
      <p>CFOP, classificação e tributos pendentes de conferência fiscal.</p>
    </>
  );
}

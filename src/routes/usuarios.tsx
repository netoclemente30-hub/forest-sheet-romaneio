import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { listarUsuarios, criarUsuario, alterarSenhaUsuario, definirAdmin, removerUsuario, listarEmpresas, criarEmpresa, definirEmpresa, definirStatusEmpresa, definirCnpjEmpresa, excluirEmpresa, definirFuncao, statusFuncoes } from "@/lib/usuarios.functions";
import { FUNCOES, funcaoValida, nomePapel, type FuncaoFuncionario } from "@/lib/funcoes";
import { formatarCnpj, LIMITE_DEMONSTRACAO, type StatusEmpresa } from "@/lib/cnpj";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Trash2, KeyRound, UserPlus, Building2 } from "lucide-react";

export const Route = createFileRoute("/usuarios")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Usuários — Manejo Florestal" },
      { name: "description", content: "Gerencie empresas e quem tem acesso ao aplicativo." },
      { property: "og:title", content: "Usuários — Manejo Florestal" },
      { property: "og:description", content: "Gerencie empresas e quem tem acesso ao aplicativo." },
    ],
  }),
  component: UsuariosPage,
});

function UsuariosPage() {
  const { session, isAdmin, isSuperAdmin, empresaId: minhaEmpresaId, loading: loadingSessao, permissoesCarregando } = useAuth();
  const loading = loadingSessao || permissoesCarregando;
  const nav = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [funcaoNova, setFuncaoNova] = useState<FuncaoFuncionario>("cortador");
  const [empresaId, setEmpresaId] = useState("");
  const [novaEmpresa, setNovaEmpresa] = useState("");
  const [novaSenha, setNovaSenha] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const usuarios = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => listarUsuarios(),
    enabled: isAdmin || isSuperAdmin,
  });
  const situacaoFuncoes = useQuery({
    queryKey: ["situacao-funcoes"],
    queryFn: () => statusFuncoes(),
    enabled: isAdmin || isSuperAdmin,
  });
  const habilitadas = situacaoFuncoes.data?.habilitadas === true;

  const empresas = useQuery({
    queryKey: ["empresas"],
    queryFn: () => listarEmpresas(),
    enabled: isAdmin || isSuperAdmin,
  });

  if (loading) return null;
  if (!isAdmin && !isSuperAdmin) {
    nav({ to: "/" });
    return null;
  }

  const souSuperAdmin = isSuperAdmin;
  const listaEmpresas = souSuperAdmin ? (empresas.data ?? []) : (empresas.data ?? []).filter((e) => e.id === minhaEmpresaId);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    const emp = empresaId || listaEmpresas[0]?.id || "";
    if (!emp) { toast.error("Escolha a empresa do novo acesso"); return; }
    setBusy(true);
    try {
      await criarUsuario({ data: { email, password: senha, empresaId: emp, funcao: funcaoNova } });
      toast.success(`Funcionário ${email} cadastrado como ${nomePapel(funcaoNova)}.`);
      setEmail("");
      setSenha("");
      await qc.invalidateQueries({ queryKey: ["usuarios"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(false);
  }

  async function cadastrarEmpresa(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await criarEmpresa({ data: { nome: novaEmpresa } });
      toast.success(`Empresa "${novaEmpresa.trim()}" criada. Agora crie o acesso dela abaixo.`);
      setNovaEmpresa("");
      await qc.invalidateQueries({ queryKey: ["empresas"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(false);
  }

  async function trocarSenha(userId: string) {
    const password = novaSenha[userId] ?? "";
    setBusy(true);
    try {
      await alterarSenhaUsuario({ data: { userId, password } });
      toast.success("Senha alterada");
      setNovaSenha((s) => ({ ...s, [userId]: "" }));
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(false);
  }

  async function toggleAdmin(userId: string, admin: boolean) {
    try {
      await definirAdmin({ data: { userId, admin: !admin } });
      await qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success(admin ? "Agora é operador" : "Agora é admin da empresa");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function trocarFuncao(userId: string, funcao: string) {
    if (!funcaoValida(funcao)) return;
    try {
      await definirFuncao({ data: { userId, funcao } });
      await qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success("Função atualizada: " + nomePapel(funcao));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível alterar a função");
    }
  }

  async function trocarEmpresa(userId: string, novaEmpresaId: string) {
    try {
      await definirEmpresa({ data: { userId, empresaId: novaEmpresaId } });
      await qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success("Empresa do usuário alterada");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function mudarStatus(id: string, status: StatusEmpresa) {
    try {
      await definirStatusEmpresa({ data: { empresaId: id, status } });
      await qc.invalidateQueries({ queryKey: ["empresas"] });
      toast.success("Situação da empresa atualizada");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const pendentes = (empresas.data ?? []).filter((e) => e.status === "pendente");

  async function remover(userId: string, userEmail: string) {
    if (!confirm(`Remover o acesso de ${userEmail}?`)) return;
    try {
      await removerUsuario({ data: { userId } });
      await qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success("Usuário removido");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold uppercase">Usuários</h1>
      <p className="text-sm text-muted-foreground">
        Cadastre um acesso individual por funcionário e defina o cargo. Cada funcionário terá acesso somente às áreas de trabalho permitidas na sua empresa.
      </p>

      {souSuperAdmin && pendentes.length > 0 && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <p className="font-semibold">{pendentes.length === 1 ? "1 novo cadastro aguardando liberação" : `${pendentes.length} novos cadastros aguardando liberação`}</p>
          <p className="text-muted-foreground">Escolha "Demonstração" para liberar {LIMITE_DEMONSTRACAO} toras ou "Ativa" para o acesso completo.</p>
        </div>
      )}

      {souSuperAdmin && (
        <div className="bg-card border rounded-xl divide-y">
          <div className="p-3 font-semibold text-sm flex items-center gap-2"><Building2 className="size-4" /> Empresas</div>
          {(empresas.data ?? []).map((e) => (
            <div key={e.id} className={`p-3 flex flex-wrap items-center gap-2 ${e.status === "pendente" ? "bg-destructive/5" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{e.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {e.cnpj ? `CNPJ ${formatarCnpj(e.cnpj)} · ` : ""}{e.toras} toras{e.status === "demonstracao" ? ` de ${LIMITE_DEMONSTRACAO}` : ""}
                </div>
              </div>
              <select
                aria-label={`Situação de ${e.nome}`}
                value={e.status}
                onChange={(ev) => mudarStatus(e.id, ev.target.value as StatusEmpresa)}
                className="h-10 rounded-md border bg-background px-2 text-sm"
              >
                <option value="pendente">Aguardando liberação</option>
                <option value="demonstracao">Demonstração</option>
                <option value="ativa">Ativa</option>
                <option value="inativa">Inativa</option>
              </select>
              {souSuperAdmin && (
                <Button type="button" size="sm" variant="outline" onClick={async () => {
                  const cnpj = window.prompt(`CNPJ de ${e.nome}`, e.cnpj ? formatarCnpj(e.cnpj) : "");
                  if (cnpj === null) return;
                  const ie = window.prompt(`Inscrição estadual de ${e.nome}`, "") ?? "";
                  try { await definirCnpjEmpresa({ data: { empresaId: e.id, cnpj, ie } }); toast.success("CNPJ salvo."); await qc.invalidateQueries(); }
                  catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao salvar CNPJ"); }
                }}>CNPJ</Button>
              )}
              <Button type="button" size="icon" variant="ghost" aria-label={`Excluir empresa ${e.nome}`} onClick={async () => {
                if (!confirm(`Excluir a empresa ${e.nome}? Os acessos dela ficam sem empresa. Isso não pode ser desfeito.`)) return;
                try { await excluirEmpresa({ data: { empresaId: e.id } }); toast.success("Empresa excluída."); await qc.invalidateQueries(); }
                catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao excluir empresa"); }
              }}><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </div>
      )}

      {souSuperAdmin && (
        <form onSubmit={cadastrarEmpresa} className="bg-card border rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Building2 className="size-4" /> Nova empresa
          </div>
          <div className="flex gap-2">
            <Input
              value={novaEmpresa}
              onChange={(e) => setNovaEmpresa(e.target.value)}
              placeholder="Nome da empresa (ex.: RJ Madeiras)"
              required
              className="h-11"
            />
            <Button type="submit" className="h-11 shrink-0" disabled={busy}>Criar</Button>
          </div>
        </form>
      )}

      {!habilitadas && (
        <p role="alert" className="rounded-xl border p-3 text-sm">
          Cadastro de funções em preparação. A estrutura de permissões precisa ser habilitada no banco pela Lovable
          antes que funcionários possam ser cadastrados ou receber cargos. Nenhum funcionário existente foi alterado.
        </p>
      )}

      <form onSubmit={criar} className="bg-card border rounded-xl p-3 space-y-2">
        <div className="space-y-1">
          <Label className="text-xs">Empresa</Label>
          <select
            value={empresaId || listaEmpresas[0]?.id || ""}
            onChange={(e) => setEmpresaId(e.target.value)}
            className="w-full h-11 rounded-md border bg-background px-3 text-sm"
            aria-label="Empresa do novo acesso"
          >
            {listaEmpresas.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Função do funcionário</Label>
          <select value={funcaoNova} onChange={(ev) => {
            if (funcaoValida(ev.target.value)) setFuncaoNova(ev.target.value);
          }} className="w-full h-11 rounded-md border bg-background px-3 text-sm"
            aria-label="Função do novo funcionário">
            {FUNCOES.map((f) => <option key={f.valor} value={f.valor}>{f.nome}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">{FUNCOES.find((f) => f.valor === funcaoNova)?.descricao}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">E-mail</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Senha (criada por você)</Label>
          <Input type="password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} className="h-11" />
        </div>
        <Button type="submit" className="w-full h-11" disabled={busy || !habilitadas}>
          <UserPlus /> Criar acesso
        </Button>
      </form>

      <div className="bg-card border rounded-xl divide-y">
        {(usuarios.data ?? []).map((u) => (
          <div key={u.id} className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{u.email}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {u.empresa && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Building2 className="size-3" /> {u.empresa}
                    </span>
                  )}
                  {u.super && (
                    <span className="inline-flex items-center gap-1 text-primary font-semibold">
                      <ShieldCheck className="size-3" /> Administrador geral
                    </span>
                  )}
                  {!u.super && (
                    <span className={`inline-flex items-center gap-1 ${u.admin ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                      {u.admin && <ShieldCheck className="size-3" />} {u.admin ? "Admin da empresa" : (u.funcao ? nomePapel(u.funcao) : "Sem função atribuída")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {u.id !== session?.user.id && (
                  <>
                    {souSuperAdmin && !u.super && (
                      <select
                        aria-label={`Função de ${u.email}`}
                        value={u.admin ? "admin" : "funcionario"}
                        onChange={(ev) => (ev.target.value === "admin") !== u.admin && toggleAdmin(u.id, u.admin)}
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                      >
                        <option value="funcionario">Funcionário</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                    {!u.admin && !u.super && (
                      <select
                        aria-label={`Cargo de ${u.email}`}
                        className="h-9 max-w-40 rounded-md border bg-background px-2 text-xs"
                        disabled={!habilitadas || busy}
                        value={u.funcao ?? ""}
                        onChange={(ev) => void trocarFuncao(u.id, ev.target.value)}
                      >
                        {!u.funcao && <option value="">Sem função</option>}
                        {FUNCOES.map((f) => <option key={f.valor} value={f.valor}>{f.nome}</option>)}
                      </select>
                    )}
                    <Button size="icon" variant="ghost" aria-label="Remover usuário" onClick={() => remover(u.id, u.email)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            {souSuperAdmin && u.id !== session?.user.id && (
              <select
                value={u.empresaId ?? ""}
                onChange={(e) => e.target.value && trocarEmpresa(u.id, e.target.value)}
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                aria-label={`Empresa de ${u.email}`}
              >
                {!u.empresaId && <option value="">Sem empresa</option>}
                {listaEmpresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Nova senha"
                aria-label={`Nova senha para ${u.email}`}
                value={novaSenha[u.id] ?? ""}
                onChange={(e) => setNovaSenha((s) => ({ ...s, [u.id]: e.target.value }))}
                className="h-10"
              />
              <Button size="sm" variant="secondary" className="h-10" disabled={busy || (novaSenha[u.id] ?? "").length < 6} onClick={() => trocarSenha(u.id)}>
                <KeyRound /> Trocar
              </Button>
            </div>
          </div>
        ))}
        {usuarios.data && !usuarios.data.length && <div className="p-4 text-sm text-muted-foreground">Nenhum usuário encontrado.</div>}
      </div>
    </div>
  );
}

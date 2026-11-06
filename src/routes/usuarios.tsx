import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { listarUsuarios, criarUsuario, alterarSenhaUsuario, definirAdmin, removerUsuario, listarEmpresas, criarEmpresa, definirEmpresa } from "@/lib/usuarios.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Trash2, KeyRound, UserPlus, Building2 } from "lucide-react";

export const Route = createFileRoute("/usuarios")({
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
  const { session, isAdmin, isSuperAdmin, empresaId: minhaEmpresaId, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [novaEmpresa, setNovaEmpresa] = useState("");
  const [novaSenha, setNovaSenha] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const usuarios = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => listarUsuarios(),
    enabled: isAdmin || isSuperAdmin,
  });
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
      await criarUsuario({ data: { email, password: senha, empresaId: emp } });
      toast.success(`Acesso criado para ${email}. Envie a senha pelo WhatsApp.`);
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
      toast.success(admin ? "Deixou de ser administrador" : "Agora é administrador");
    } catch (err) {
      toast.error((err as Error).message);
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
        Cada empresa tem um acesso próprio, compartilhado pelos funcionários. Os dados de cada empresa ficam separados.
      </p>

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
          <Label className="text-xs">E-mail</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Senha (criada por você)</Label>
          <Input type="text" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} className="h-11" />
        </div>
        <Button type="submit" className="w-full h-11" disabled={busy}>
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
                  {u.admin && !u.super && (
                    <span className="inline-flex items-center gap-1 text-primary font-semibold">
                      <ShieldCheck className="size-3" /> Admin da empresa
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {u.id !== session?.user.id && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => toggleAdmin(u.id, u.admin)}>
                      {u.admin ? "Tirar admin" : "Tornar admin"}
                    </Button>
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
                type="text"
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

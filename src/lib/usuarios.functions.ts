import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cnpjValido, limparCnpj, type StatusEmpresa } from "@/lib/cnpj";
import { funcaoValida, type FuncaoFuncionario } from "@/lib/funcoes";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

async function exigirAdmin(supabase: Ctx["supabase"], userId: string) {
  const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "superadmin" }),
  ]);
  if (!isAdmin && !isSuper) throw new Error("Apenas o administrador pode gerenciar usuários");
}

async function exigirSuperAdmin(supabase: Ctx["supabase"], userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "superadmin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas o administrador geral pode executar esta operação");
}

async function escopoAdministrativo(ctx: Ctx): Promise<{ superadmin: boolean; empresa: string | null }> {
  await exigirAdmin(ctx.supabase, ctx.userId);
  const { data: superadmin, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId, _role: "superadmin",
  });
  if (error) throw new Error(error.message);
  const empresa = superadmin ? null : await empresaDoAdmin(ctx.supabase);
  if (!superadmin && !empresa) throw new Error("Seu cadastro de administrador não possui empresa");
  return { superadmin: !!superadmin, empresa };
}

function tabelaFuncoes(supabaseAdmin: import("@supabase/supabase-js").SupabaseClient<Database>) {
  // A tabela só existirá após a implantação pela Lovable.
  // Não modificar o types.ts gerado. O cast é estritamente local à nova tabela.
  return supabaseAdmin.from("funcoes_funcionarios" as "user_roles");
}

export const statusFuncoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    await escopoAdministrativo(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await tabelaFuncoes(supabaseAdmin).select("user_id", { head: true, count: "exact" });
    return { habilitadas: !error };
  });

/** Empresa que o admin logado pode gerenciar. NULL = administrador geral (gerencia todas). */
async function empresaDoAdmin(supabase: Ctx["supabase"]): Promise<string | null> {
  const { data, error } = await supabase.rpc("admin_minha_empresa");
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

/** Garante que o usuário-alvo pertence à empresa do admin (quando ele não é administrador geral). */
async function exigirMesmaEmpresa(supabaseAdmin: SupabaseClient<Database>, minha: string | null, userId: string) {
  if (!minha) return;
  const { data } = await supabaseAdmin.from("empresa_usuarios").select("empresa_id").eq("user_id", userId).maybeSingle();
  if (data?.empresa_id !== minha) throw new Error("Você só pode gerenciar usuários da sua empresa");
}

async function exigirAlvoGerenciavel(ctx: Ctx, supabaseAdmin: SupabaseClient<Database>, userId: string) {
  const escopo = await escopoAdministrativo(ctx);
  await exigirMesmaEmpresa(supabaseAdmin, escopo.empresa, userId);
  if (!escopo.superadmin) {
    const { data, error } = await supabaseAdmin.from("user_roles")
      .select("role").eq("user_id", userId);
    if (error) throw new Error(error.message);
    if ((data ?? []).some(({ role }) => role === "admin" || role === "superadmin"))
      throw new Error("O administrador da empresa não pode alterar contas administrativas");
  }
}

export const listarEmpresas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    await exigirAdmin(ctx.supabase, ctx.userId);
    const { data: superadmin, error: roleError } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "superadmin" });
    if (roleError) throw new Error(roleError.message);
    const propriaEmpresa = superadmin ? null : await empresaDoAdmin(ctx.supabase);
    if (!superadmin && !propriaEmpresa) throw new Error("Empresa do administrador não encontrada");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let consulta = supabaseAdmin.from("empresas").select("id, nome, cnpj, status").order("nome");
    if (!superadmin) consulta = consulta.eq("id", propriaEmpresa!);
    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    // Contagem exata por empresa: não faz varredura global nem depende do limite de 1000 linhas.
    return Promise.all((data ?? []).map(async (e) => {
      const { count, error: erroContagem } = await supabaseAdmin.from("toras")
        .select("plaqueta", { head: true, count: "exact" }).eq("empresa_id", e.id);
      if (erroContagem) throw new Error(erroContagem.message);
      return { ...e, status: e.status as StatusEmpresa, toras: count ?? 0 };
    }));
  });

export const criarEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { nome: string }) => input)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await exigirSuperAdmin(ctx.supabase, ctx.userId);
    const nome = data.nome.trim();
    if (!nome) throw new Error("Informe o nome da empresa");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.from("empresas").insert({ nome }).select("id, nome").single();
    if (error) throw new Error(error.message);
    return created;
  });

export const listarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    await exigirAdmin(ctx.supabase, ctx.userId);
    const { empresa: minha } = await escopoAdministrativo(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 500 });
    if (error) throw error;
    const ids = data.users.map((u) => u.id);
    const [{ data: roles }, { data: vinculos }, { data: empresas }, { data: funcoes, error: erroFuncoes }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      supabaseAdmin.from("empresa_usuarios").select("user_id, empresa_id").in("user_id", ids),
      supabaseAdmin.from("empresas").select("id, nome"),
      tabelaFuncoes(supabaseAdmin).select("user_id,empresa_id,funcao").in("user_id", ids),
    ]);
    const admins = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
    const supers = new Set((roles ?? []).filter((r) => r.role === "superadmin").map((r) => r.user_id));
    const empPorUser = new Map((vinculos ?? []).map((v) => [v.user_id, v.empresa_id]));
    const nomeEmpresa = new Map((empresas ?? []).map((e) => [e.id, e.nome]));
    const atribuicoes = (erroFuncoes ? [] : (funcoes ?? [])) as unknown as {
      user_id: string; empresa_id: string; funcao: string;
    }[];
    const porUsuario = new Map(atribuicoes.map((item) => [item.user_id, item]));
    return data.users
      .filter((u) => !minha || empPorUser.get(u.id) === minha)
      .map((u) => {
        const empId = empPorUser.get(u.id) ?? null;
        return { id: u.id, email: u.email ?? "", admin: admins.has(u.id), super: supers.has(u.id), empresaId: empId, empresa: empId ? (nomeEmpresa.get(empId) ?? null) : null, funcao: porUsuario.get(u.id)?.empresa_id === empId && funcaoValida(porUsuario.get(u.id)?.funcao) ? porUsuario.get(u.id)!.funcao as FuncaoFuncionario : null };
      });
  });

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; password: string; empresaId: string; funcao: FuncaoFuncionario }) => input)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await exigirAdmin(ctx.supabase, ctx.userId);
    const escopo = await escopoAdministrativo(ctx);
    const empresaId = escopo.empresa ?? data.empresaId;
    if (!empresaId) throw new Error("Escolha a empresa do novo acesso");
    if (!funcaoValida(data.funcao)) throw new Error("Escolha uma função válida para o funcionário");
    const email = data.email.trim().toLowerCase();
    if (!email || !data.password || data.password.length < 6) throw new Error("Informe um e-mail válido e uma senha de pelo menos 6 caracteres");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password: data.password, email_confirm: true });
    if (error) throw new Error(error.message);
    const { error: vincErr } = await supabaseAdmin.from("empresa_usuarios").insert({ user_id: created.user.id, empresa_id: empresaId });
    if (vincErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(vincErr.message);
    }
    const { error: funcErr } = await tabelaFuncoes(supabaseAdmin).insert({
      user_id: created.user.id, empresa_id: empresaId, funcao: data.funcao,
    } as never);
    if (funcErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error("As funções ainda não foram ativadas no banco: " + funcErr.message);
    }
    return { id: created.user.id, email };
  });

/** Atribui um único cargo operacional ao funcionário, dentro da própria empresa. */
export const definirFuncao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; funcao: FuncaoFuncionario }) => input)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const escopo = await escopoAdministrativo(ctx);
    if (!funcaoValida(data.funcao)) throw new Error("Função inválida");
    if (data.userId === ctx.userId) throw new Error("Você não pode alterar sua própria função");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: vinculo, error: vincErr } = await supabaseAdmin
      .from("empresa_usuarios").select("empresa_id").eq("user_id", data.userId).maybeSingle();
    if (vincErr || !vinculo?.empresa_id) throw new Error("Funcionário sem empresa");
    if (!escopo.superadmin && vinculo.empresa_id !== escopo.empresa) {
      throw new Error("Você só pode gerenciar funcionários da própria empresa");
    }
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", data.userId);
    if (rolesError) throw new Error(rolesError.message);
    if ((roles ?? []).some((role) => role.role === "superadmin" || role.role === "admin")) {
      throw new Error("Cargo administrativo não pode ser alterado como cargo de funcionário");
    }
    const { error } = await tabelaFuncoes(supabaseAdmin).upsert({
      user_id: data.userId, empresa_id: vinculo.empresa_id, funcao: data.funcao,
    } as never, { onConflict: "user_id" });
    if (error) throw new Error("Funções ainda não habilitadas no banco: " + error.message);
    return { ok: true };
  });

export const definirEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; empresaId: string }) => input)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await exigirAdmin(ctx.supabase, ctx.userId);
    await exigirSuperAdmin(ctx.supabase, ctx.userId);
    if (data.userId === ctx.userId) throw new Error("Você não pode mudar a sua própria empresa");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("empresa_usuarios").upsert({ user_id: data.userId, empresa_id: data.empresaId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const alterarSenhaUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; password: string }) => input)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await exigirAdmin(ctx.supabase, ctx.userId);
    if (!data.password || data.password.length < 6) throw new Error("A senha precisa de pelo menos 6 caracteres");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await exigirAlvoGerenciavel(ctx, supabaseAdmin, data.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const definirAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; admin: boolean }) => input)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await exigirAdmin(ctx.supabase, ctx.userId);
    if (data.userId === ctx.userId && !data.admin) throw new Error("Você não pode remover o seu próprio acesso de administrador");
    const { data: souSuper } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "superadmin" });
    if (!souSuper) throw new Error("Apenas o administrador geral define quem é admin ou operador");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.admin) {
      const { error } = await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const removerUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await exigirAdmin(ctx.supabase, ctx.userId);
    if (data.userId === ctx.userId) throw new Error("Você não pode remover a sua própria conta");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await exigirAlvoGerenciavel(ctx, supabaseAdmin, data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const definirStatusEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { empresaId: string; status: StatusEmpresa }) => {
    if (!["pendente", "demonstracao", "ativa", "inativa"].includes(input.status)) throw new Error("Situação inválida");
    return input;
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: souSuper } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "superadmin" });
    if (!souSuper) throw new Error("Apenas o administrador geral muda a situação da empresa");
    const { error } = await ctx.supabase.from("empresas").update({ status: data.status }).eq("id", data.empresaId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Cadastro público: cria a empresa aguardando liberação e o acesso de operador. */
export const cadastrarEmpresaPublica = createServerFn({ method: "POST" })
  .inputValidator((input: { nome: string; cnpj: string; email: string; password: string }) => ({
    nome: String(input?.nome ?? "").trim().slice(0, 120),
    cnpj: limparCnpj(String(input?.cnpj ?? "")),
    email: String(input?.email ?? "").trim().toLowerCase().slice(0, 200),
    password: String(input?.password ?? ""),
  }))
  .handler(async ({ data }) => {
    if (data.nome.length < 2) throw new Error("Informe o nome da empresa");
    if (!cnpjValido(data.cnpj)) throw new Error("CNPJ inválido");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new Error("E-mail inválido");
    if (data.password.length < 6 || data.password.length > 72) throw new Error("A senha precisa de pelo menos 6 caracteres");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existe } = await supabaseAdmin.from("empresas").select("id").eq("cnpj", data.cnpj).maybeSingle();
    if (existe) throw new Error("Este CNPJ já está cadastrado. Peça acesso pelo WhatsApp (69) 99900-4121.");
    const { data: emp, error: eErr } = await supabaseAdmin.from("empresas")
      .insert({ nome: data.nome, cnpj: data.cnpj, status: "pendente" }).select("id").single();
    if (eErr) throw new Error(eErr.message);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: true });
    if (error) {
      await supabaseAdmin.from("empresas").delete().eq("id", emp.id);
      throw new Error(/already|registered|exists/i.test(error.message) ? "Este e-mail já tem cadastro. Use Acessar sistema." : /weak|guess/i.test(error.message) ? "Senha muito comum. Escolha outra senha." : error.message);
    }
    const { error: vErr } = await supabaseAdmin.from("empresa_usuarios").insert({ user_id: created.user.id, empresa_id: emp.id });
    if (vErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      await supabaseAdmin.from("empresas").delete().eq("id", emp.id);
      throw new Error(vErr.message);
    }
    return { ok: true };
  });

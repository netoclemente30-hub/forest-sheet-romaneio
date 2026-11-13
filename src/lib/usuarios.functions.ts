import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cnpjValido, limparCnpj, type StatusEmpresa } from "@/lib/cnpj";

type Ctx = { supabase: any; userId: string };

async function exigirAdmin(supabase: Ctx["supabase"], userId: string) {
  const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "superadmin" }),
  ]);
  if (!isAdmin && !isSuper) throw new Error("Apenas o administrador pode gerenciar usuários");
}

/** Empresa que o admin logado pode gerenciar. NULL = administrador geral (gerencia todas). */
async function empresaDoAdmin(supabase: Ctx["supabase"]): Promise<string | null> {
  const { data } = await supabase.rpc("admin_minha_empresa");
  return (data as string | null) ?? null;
}

/** Garante que o usuário-alvo pertence à empresa do admin (quando ele não é administrador geral). */
async function exigirMesmaEmpresa(supabaseAdmin: any, minha: string | null, userId: string) {
  if (!minha) return;
  const { data } = await supabaseAdmin.from("empresa_usuarios").select("empresa_id").eq("user_id", userId).maybeSingle();
  if (data?.empresa_id !== minha) throw new Error("Você só pode gerenciar usuários da sua empresa");
}

export const listarEmpresas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    await exigirAdmin(ctx.supabase, ctx.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("empresas").select("id, nome, cnpj, status").order("nome");
    if (error) throw new Error(error.message);
    const { data: toras } = await supabaseAdmin.from("toras").select("empresa_id");
    const qtd = new Map<string, number>();
    for (const t of toras ?? []) qtd.set(t.empresa_id, (qtd.get(t.empresa_id) ?? 0) + 1);
    return data.map((e) => ({ ...e, status: e.status as StatusEmpresa, toras: qtd.get(e.id) ?? 0 }));
  });

export const criarEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { nome: string }) => input)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await exigirAdmin(ctx.supabase, ctx.userId);
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
    const minha = await empresaDoAdmin(ctx.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 500 });
    if (error) throw error;
    const ids = data.users.map((u) => u.id);
    const [{ data: roles }, { data: vinculos }, { data: empresas }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      supabaseAdmin.from("empresa_usuarios").select("user_id, empresa_id").in("user_id", ids),
      supabaseAdmin.from("empresas").select("id, nome"),
    ]);
    const admins = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
    const supers = new Set((roles ?? []).filter((r) => r.role === "superadmin").map((r) => r.user_id));
    const empPorUser = new Map((vinculos ?? []).map((v) => [v.user_id, v.empresa_id]));
    const nomeEmpresa = new Map((empresas ?? []).map((e) => [e.id, e.nome]));
    return data.users
      .filter((u) => !minha || empPorUser.get(u.id) === minha)
      .map((u) => {
        const empId = empPorUser.get(u.id) ?? null;
        return { id: u.id, email: u.email ?? "", admin: admins.has(u.id), super: supers.has(u.id), empresaId: empId, empresa: empId ? (nomeEmpresa.get(empId) ?? null) : null };
      });
  });

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; password: string; empresaId: string }) => input)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await exigirAdmin(ctx.supabase, ctx.userId);
    const minha = await empresaDoAdmin(ctx.supabase);
    const empresaId = minha ?? data.empresaId;
    if (!empresaId) throw new Error("Escolha a empresa do novo acesso");
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
    return { id: created.user.id, email };
  });

export const definirEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; empresaId: string }) => input)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await exigirAdmin(ctx.supabase, ctx.userId);
    const minha = await empresaDoAdmin(ctx.supabase);
    if (minha) throw new Error("Apenas o administrador geral pode mudar a empresa de um usuário");
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
    const minha = await empresaDoAdmin(ctx.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await exigirMesmaEmpresa(supabaseAdmin, minha, data.userId);
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
    const minha = await empresaDoAdmin(ctx.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await exigirMesmaEmpresa(supabaseAdmin, minha, data.userId);
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
      throw new Error(/already|registered|exists/i.test(error.message) ? "Este e-mail já tem cadastro. Use Acessar sistema." : error.message);
    }
    const { error: vErr } = await supabaseAdmin.from("empresa_usuarios").insert({ user_id: created.user.id, empresa_id: emp.id });
    if (vErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      await supabaseAdmin.from("empresas").delete().eq("id", emp.id);
      throw new Error(vErr.message);
    }
    return { ok: true };
  });

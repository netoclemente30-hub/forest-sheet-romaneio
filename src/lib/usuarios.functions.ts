import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function exigirAdmin(supabase: Ctx["supabase"], userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) throw new Error("Apenas o administrador pode gerenciar usuários");
}

/** Empresa que o admin logado pode gerenciar. NULL = super-admin (gerencia todas). */
async function empresaDoAdmin(supabase: Ctx["supabase"]): Promise<string | null> {
  const { data } = await supabase.rpc("admin_minha_empresa");
  return (data as string | null) ?? null;
}

export const listarEmpresas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    await exigirAdmin(ctx.supabase, ctx.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("empresas").select("id, nome").order("nome");
    if (error) throw new Error(error.message);
    return data;
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
    const empPorUser = new Map((vinculos ?? []).map((v) => [v.user_id, v.empresa_id]));
    const nomeEmpresa = new Map((empresas ?? []).map((e) => [e.id, e.nome]));
    return data.users
      .filter((u) => !minha || empPorUser.get(u.id) === minha)
      .map((u) => {
        const empId = empPorUser.get(u.id) ?? null;
        return { id: u.id, email: u.email ?? "", admin: admins.has(u.id), empresaId: empId, empresa: empId ? (nomeEmpresa.get(empId) ?? null) : null };
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
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

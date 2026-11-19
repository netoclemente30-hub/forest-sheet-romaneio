import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ErroFiscal } from "./fiscal-spedy.core";

type Ctx = { supabase: { rpc: (...a: never[]) => unknown }; userId: string };
/** Autorização fiscal: administrador da empresa vinculada ou administrador geral (pode_fiscal no banco). */
async function autorizar(context: Ctx, empresa: string) {
  const sb = context.supabase as unknown as {
    rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await sb.rpc("pode_fiscal", { _empresa: empresa });
  if (error || data !== true) throw new Error("Acesso fiscal restrito ao administrador da empresa.");
}
const erro = (e: unknown) => {
  if (e instanceof ErroFiscal) return { ok: false as const, codigo: e.codigo, mensagem: e.message };
  console.error("fiscal", e);
  return { ok: false as const, codigo: "interno", mensagem: "Falha ao processar a operação fiscal." };
};
const base = z.object({ empresa: z.string().uuid() });

export const verificarSpedy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(base)
  .handler(async ({ data, context }) => {
    await autorizar(context as unknown as Ctx, data.empresa);
    const { verificarSandbox } = await import("./spedy.server");
    return verificarSandbox(data.empresa);
  });

export const diagnosticarSpedy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(base.extend({ cnpj: z.string().max(20) }))
  .handler(async ({ data, context }) => {
    await autorizar(context as unknown as Ctx, data.empresa);
    const s = await import("./spedy.server");
    const { diagnosticar } = await import("./fiscal-spedy.core");
    return diagnosticar(s.httpSandbox(data.empresa, 10000), await s.storeAdmin(), data.empresa, data.cnpj);
  });

export const emitirNfeHomologacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(base.extend({
    rascunhoId: z.string().min(1).max(120),
    origem: z.string().max(120).nullable(),
    confirmacao: z.literal("HOMOLOGACAO"),
    nota: z.unknown(),
  }))
  .handler(async ({ data, context }) => {
    await autorizar(context as unknown as Ctx, data.empresa);
    try {
      const s = await import("./spedy.server");
      const { emitirNota } = await import("./fiscal-spedy.core");
      const r = await emitirNota(
        { http: s.httpSandbox(data.empresa), store: await s.storeAdmin(), empresa: data.empresa, usuario: context.userId },
        data.rascunhoId, data.origem, data.nota as never,
      );
      return { ok: true as const, ...r };
    } catch (e) { return erro(e); }
  });

export const consultarNfeHomologacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(base.extend({ rascunhoId: z.string().min(1).max(120) }))
  .handler(async ({ data, context }) => {
    await autorizar(context as unknown as Ctx, data.empresa);
    try {
      const s = await import("./spedy.server");
      const { consultarNota } = await import("./fiscal-spedy.core");
      const r = await consultarNota({ http: s.httpSandbox(data.empresa), store: await s.storeAdmin(), empresa: data.empresa, usuario: context.userId }, data.rascunhoId);
      return { ok: true as const, ...r };
    } catch (e) { return erro(e); }
  });

export const baixarNfeHomologacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(base.extend({ rascunhoId: z.string().min(1).max(120), tipo: z.enum(["xml", "pdf"]) }))
  .handler(async ({ data, context }) => {
    await autorizar(context as unknown as Ctx, data.empresa);
    try {
      const s = await import("./spedy.server");
      const { baixarArquivo } = await import("./fiscal-spedy.core");
      const { caminho } = await baixarArquivo({ http: s.httpSandbox(data.empresa), store: await s.storeAdmin(), empresa: data.empresa }, data.rascunhoId, data.tipo);
      return { ok: true as const, base64: await s.baixarSandbox(data.empresa, caminho), tipo: data.tipo };
    } catch (e) { return erro(e); }
  });

export const inutilizarHomologacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(base.extend({
    confirmacao: z.literal("HOMOLOGACAO"),
    cnpj: z.string().max(20), serie: z.number(), inicio: z.number(), fim: z.number(), justificativa: z.string().max(255),
  }))
  .handler(async ({ data, context }) => {
    await autorizar(context as unknown as Ctx, data.empresa);
    try {
      const s = await import("./spedy.server");
      const { inutilizar } = await import("./fiscal-spedy.core");
      const r = await inutilizar(
        { http: s.httpSandbox(data.empresa), store: await s.storeAdmin(), empresa: data.empresa, usuario: context.userId },
        { emitenteCnpj: data.cnpj, serie: data.serie, inicio: data.inicio, fim: data.fim, justificativa: data.justificativa },
      );
      return { ok: true as const, situacao: r.situacao, mensagem: r.mensagem };
    } catch (e) { return erro(e); }
  });

// ---------- Onboarding Spedy: empresa e certificado A1 ----------
async function cnpjDaEmpresa(context: Ctx, empresa: string) {
  const sb = context.supabase as unknown as {
    from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { cnpj: string | null } | null }> } } };
  };
  const { data } = await sb.from("empresas").select("cnpj").eq("id", empresa).maybeSingle();
  return data?.cnpj ?? null;
}
async function ctxOnboarding(context: Ctx, empresa: string) {
  await autorizar(context, empresa); // antes de qualquer segredo ou HTTP
  const s = await import("./spedy.server");
  return {
    s,
    ctx: { http: s.httpSandbox(empresa), store: await s.storeOnboarding(), empresa, usuario: context.userId, cnpjAutorizado: await cnpjDaEmpresa(context, empresa) },
  };
}

export const verificarCadastroSpedy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(base.extend({ cnpj: z.string().max(20) }))
  .handler(async ({ data, context }) => {
    try {
      const { ctx } = await ctxOnboarding(context as unknown as Ctx, data.empresa);
      const { verificarCadastro } = await import("./spedy-onboarding.core");
      return { ok: true as const, ...(await verificarCadastro(ctx, data.cnpj)) };
    } catch (e) { return erro(e); }
  });

export const cadastrarEmpresaSpedy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(base.extend({
    modo: z.enum(["criar", "vincular"]),
    confirmacao: z.literal("HOMOLOGACAO"),
    dados: z.unknown(),
  }))
  .handler(async ({ data, context }) => {
    try {
      const { ctx } = await ctxOnboarding(context as unknown as Ctx, data.empresa);
      const m = await import("./spedy-onboarding.core");
      const d = data.dados as import("./spedy-onboarding.core").EmpresaSpedyEntrada;
      const r = data.modo === "vincular" ? await m.vincularEmpresa(ctx, String((d as { cnpj?: unknown })?.cnpj ?? "")) : await m.criarEmpresa(ctx, d);
      return { ok: r.situacao !== "erro", situacao: r.situacao, mensagem: r.mensagem };
    } catch (e) { return erro(e); }
  });

export const enviarCertificadoSpedy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((fd: unknown) => {
    if (!(fd instanceof FormData)) throw new Error("Envio inválido.");
    const arquivo = fd.get("arquivo");
    const empresa = z.string().uuid().parse(fd.get("empresa"));
    if (fd.get("confirmacao") !== "HOMOLOGACAO") throw new Error("Confirmação obrigatória.");
    if (!(arquivo instanceof File)) throw new Error("Arquivo ausente.");
    return { empresa, arquivo, senha: String(fd.get("senha") ?? ""), substituir: fd.get("substituir") === "1" };
  })
  .handler(async ({ data, context }) => {
    try {
      const { s, ctx } = await ctxOnboarding(context as unknown as Ctx, data.empresa);
      const { enviarCertificado, MAX_CERTIFICADO } = await import("./spedy-onboarding.core");
      if (data.arquivo.size > MAX_CERTIFICADO) return { ok: false as const, codigo: "arquivo", mensagem: "Arquivo vazio ou maior que 100 KB." };
      const bytes = new Uint8Array(await data.arquivo.arrayBuffer());
      const r = await enviarCertificado({ ...ctx, form: s.formSandbox(data.empresa) }, { nome: data.arquivo.name, bytes }, data.senha, data.substituir);
      bytes.fill(0);
      return { ok: r.situacao === "enviado" || r.situacao === "confirmar_substituicao", ...r };
    } catch (e) { return erro(e); }
  });

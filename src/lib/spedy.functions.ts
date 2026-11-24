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

export const consultarEventosNfe = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator(base.extend({rascunhoId:z.string().min(1).max(120)}))
  .handler(async({data,context})=>{
    await autorizar(context as unknown as Ctx,data.empresa);
    try{
      const {httpSandbox}=await import("./spedy.server");
      const {storeEventos}=await import("./spedy-eventos.server");
      const {consultarEventosNota}=await import("./spedy-eventos.core");
      return {ok:true as const,...await consultarEventosNota({http:httpSandbox(data.empresa),store:await storeEventos(),empresa:data.empresa,usuario:context.userId},data.rascunhoId)};
    }catch(e){return e instanceof ErroFiscal?{ok:false as const,mensagem:e.message}:{ok:false as const,mensagem:"Falha ao consultar os eventos fiscais."};}
  });

export const enviarEventoNfe = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator(base.extend({rascunhoId:z.string().min(1).max(120),confirmacao:z.literal("HOMOLOGACAO"),tipo:z.enum(["cancelamento","correcao"]),texto:z.string().max(1000)}))
  .handler(async({data,context})=>{
    await autorizar(context as unknown as Ctx,data.empresa);
    try{
      const {httpSandbox}=await import("./spedy.server");
      const {storeEventos}=await import("./spedy-eventos.server");
      const {enviarEventoNota}=await import("./spedy-eventos.core");
      return {ok:true as const,...await enviarEventoNota({http:httpSandbox(data.empresa),store:await storeEventos(),empresa:data.empresa,usuario:context.userId},data.rascunhoId,{tipo:data.tipo,texto:data.texto})};
    }catch(e){return e instanceof ErroFiscal?{ok:false as const,mensagem:e.message}:{ok:false as const,mensagem:"Falha na operação. Consulte o histórico antes de tentar novamente."};}
  });

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
// Regras e tratamento de erro ficam em spedy-onboarding.wrapper.ts (sem console.error de exceções).
function depsOnboarding(context: Ctx) {
  const sb = context.supabase as unknown as {
    rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { cnpj: string | null } | null }> } } };
  };
  return {
    usuario: context.userId,
    autorizar: async (empresa: string) => { const { data, error } = await sb.rpc("pode_fiscal", { _empresa: empresa }); return !error && data === true; },
    cnpj: async (empresa: string) => (await sb.from("empresas").select("cnpj").eq("id", empresa).maybeSingle()).data?.cnpj ?? null,
    servidor: () => import("./spedy.server"),
  };
}

export const verificarCadastroSpedy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(base.extend({ cnpj: z.string().max(20) }))
  .handler(async ({ data, context }) => {
    const w = await import("./spedy-onboarding.wrapper");
    return w.onboardingVerificar(depsOnboarding(context as unknown as Ctx), data.empresa, data.cnpj);
  });

export const cadastrarEmpresaSpedy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(base.extend({ modo: z.enum(["criar", "vincular"]), confirmacao: z.literal("HOMOLOGACAO"), dados: z.unknown() }))
  .handler(async ({ data, context }) => {
    const w = await import("./spedy-onboarding.wrapper");
    return w.onboardingCadastrar(depsOnboarding(context as unknown as Ctx), data.empresa, data.modo, data.dados);
  });

export const enviarCertificadoSpedy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // Não lança: erros de formato viram resposta segura no handler, sem log do corpo.
  .inputValidator((fd: unknown) => (fd instanceof FormData ? fd : null))
  .handler(async ({ data, context }) => {
    const w = await import("./spedy-onboarding.wrapper");
    return w.onboardingCertificado(depsOnboarding(context as unknown as Ctx), data);
  });

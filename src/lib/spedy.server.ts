export async function verificarSandbox(empresa: string) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(empresa))
    throw new Error("Empresa inválida.");
  const chave = chaveSandbox(empresa);
  if (!chave) return "Chave de homologação pendente no servidor.";
  try {
    const resposta = await fetch(
      "https://sandbox-api.spedy.com.br/v1/product-invoices?pageSize=1",
      {
        method: "GET",
        headers: { "X-Api-Key": chave },
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );
    await resposta.body?.cancel();
    if (resposta.ok) return "A Spedy aceitou a chave no sandbox.";
    if ([401, 403].includes(resposta.status))
      return "A Spedy recusou o acesso. Confira a chave da empresa.";
  } catch {
    /* A interface recebe somente um diagnóstico sem dados fiscais. */
  }
  return "Consulta indisponível. Tente novamente.";
}

/** Chave da empresa tem prioridade; senão usa a chave mestra única da plataforma. */
export const EMPRESA_MESTRA = "6d4582f7-b121-4d90-9708-e8c544591397";

export function chaveSandbox(empresa: string): string | undefined {
  return (
    process.env[nomeSegredo(empresa)] ||
    process.env["SPEDY_SANDBOX_KEY"] ||
    // Chave da conta integradora (Madenorte) serve de mestra para as demais empresas.
    process.env[nomeSegredo(EMPRESA_MESTRA)] ||
    undefined
  );
}

// ---------- Emissão em homologação (somente servidor) ----------
import type { Documento, Http, Inutilizacao, Store } from "./fiscal-spedy.core";
import { SPEDY_SANDBOX, TEMPO_TRAVA_MS } from "./fiscal-spedy.core";

export const nomeSegredo = (empresa: string) =>
  "SPEDY_SANDBOX_KEY_" + empresa.replaceAll("-", "_").toUpperCase();

/** Cliente HTTP fixo no sandbox. Não existe caminho para a URL de produção. */
export function httpSandbox(empresa: string, timeoutMs = 15000): Http | null {
  const chave = chaveSandbox(empresa);
  if (!chave) return null;
  return async (caminho, init) => {
    const r = await fetch(SPEDY_SANDBOX + caminho, {
      method: init?.method ?? "GET",
      headers: { "X-Api-Key": chave, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
      body: init?.body ? JSON.stringify(init.body) : null,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const txt = await r.text();
    let json: unknown = null;
    try { json = txt ? JSON.parse(txt) : null; } catch { json = { message: txt.slice(0, 300) }; }
    return { status: r.status >= 300 && r.status < 400 ? 502 : r.status, json };
  };
}

export async function baixarSandbox(empresa: string, caminho: string) {
  const chave = chaveSandbox(empresa);
  if (!chave) throw new Error("Chave pendente.");
  const r = await fetch(SPEDY_SANDBOX + caminho, { headers: { "X-Api-Key": chave }, redirect: "manual", signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error("Arquivo indisponível na Spedy.");
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.byteLength > 6_000_000) throw new Error("Arquivo grande demais.");
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

const COLS = "id,empresa_id,rascunho_id,status,payload_hash,spedy_id,numero,serie,chave_acesso,protocolo,mensagem,tentativa_em";
export async function storeAdmin(): Promise<Store> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const agoraIso = () => new Date().toISOString();
  return {
    async config(empresa) {
      const { data } = await db.from("fiscal_config").select("spedy_company_id,cnpj").eq("empresa_id", empresa).maybeSingle();
      return data;
    },
    async salvarConfig(empresa, id, cnpj) {
      await db.from("fiscal_config").upsert({ empresa_id: empresa, spedy_company_id: id, cnpj, atualizado_em: agoraIso() }).throwOnError();
    },
    async documento(empresa, rascunho) {
      const { data } = await db.from("fiscal_documentos").select(COLS).eq("empresa_id", empresa).eq("rascunho_id", rascunho).maybeSingle();
      return data as Documento | null;
    },
    async criarDocumento(empresa, rascunho, origem) {
      await db.from("fiscal_documentos").upsert({ empresa_id: empresa, rascunho_id: rascunho, origem }, { onConflict: "empresa_id,rascunho_id", ignoreDuplicates: true }).throwOnError();
      const { data } = await db.from("fiscal_documentos").select(COLS).eq("empresa_id", empresa).eq("rascunho_id", rascunho).single().throwOnError();
      return data as Documento;
    },
    async reservar(id, hash, usuario, agora) {
      const limite = new Date(agora.getTime() - TEMPO_TRAVA_MS).toISOString();
      const { data } = await db.from("fiscal_documentos")
        .update({ status: "enviando", payload_hash: hash, tentativa_em: agora.toISOString(), enviado_por: usuario, atualizado_em: agoraIso() })
        .eq("id", id)
        .or(`status.in.(preparada,rejected,erro,incerto),and(status.eq.enviando,tentativa_em.lt.${limite})`)
        .select(COLS).maybeSingle();
      return data as Documento | null;
    },
    async atualizar(id, campos) {
      await db.from("fiscal_documentos").update({ ...campos, atualizado_em: agoraIso() }).eq("id", id).throwOnError();
    },
    async inutilizacao(empresa, serie, inicio, fim, justificativa) {
      const { data: outras } = await db.from("fiscal_inutilizacoes").select("id,inicio,fim,serie")
        .eq("empresa_id", empresa).eq("serie", serie).lte("inicio", fim).gte("fim", inicio);
      const { data: notas } = await db.from("fiscal_documentos").select("numero")
        .eq("empresa_id", empresa).eq("serie", String(serie)).not("numero", "is", null);
      const exata = (outras ?? []).find((o) => o.inicio === inicio && o.fim === fim);
      const sobreposta = (outras ?? []).some((o) => o !== exata) ||
        (notas ?? []).some((n) => Number(n.numero) >= inicio && Number(n.numero) <= fim);
      if (sobreposta) return { registro: { id: "", status: "", spedy_id: null, protocolo: null, mensagem: null }, sobreposta };
      if (!exata) await db.from("fiscal_inutilizacoes").upsert({ empresa_id: empresa, serie, inicio, fim, justificativa }, { onConflict: "empresa_id,serie,inicio,fim", ignoreDuplicates: true }).throwOnError();
      const { data } = await db.from("fiscal_inutilizacoes").select("id,status,spedy_id,protocolo,mensagem")
        .eq("empresa_id", empresa).eq("serie", serie).eq("inicio", inicio).eq("fim", fim).single().throwOnError();
      return { registro: data as Inutilizacao, sobreposta: false };
    },
    async reservarInutilizacao(id, usuario, agora) {
      const limite = new Date(agora.getTime() - TEMPO_TRAVA_MS).toISOString();
      const { data } = await db.from("fiscal_inutilizacoes")
        .update({ status: "enviando", tentativa_em: agora.toISOString(), enviado_por: usuario, atualizado_em: agoraIso() })
        .eq("id", id).or(`status.in.(preparada,rejected,erro,incerto),and(status.eq.enviando,tentativa_em.lt.${limite})`)
        .select("id,status,spedy_id,protocolo,mensagem").maybeSingle();
      return data as Inutilizacao | null;
    },
    async atualizarInutilizacao(id, campos) {
      await db.from("fiscal_inutilizacoes").update({ ...campos, atualizado_em: agoraIso() }).eq("id", id).throwOnError();
    },
    async evento(e) {
      await db.from("fiscal_eventos").insert(e).throwOnError();
    },
  };
}

// ---------- Onboarding: empresa e certificado A1 (sandbox) ----------
import type { HttpForm, OnboardingStore } from "./spedy-onboarding.core";

/** Envio multipart fixo no sandbox. Não define Content-Type: o FormData gera o boundary. Nunca registra o corpo. */
export function formSandbox(empresa: string, timeoutMs = 30000): HttpForm | null {
  const chave = chaveSandbox(empresa);
  if (!chave) return null;
  return async (caminho, form) => {
    const r = await fetch(SPEDY_SANDBOX + caminho, {
      method: "POST", headers: { "X-Api-Key": chave }, body: form,
      redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(timeoutMs),
    });
    const txt = await r.text();
    let json: unknown = null;
    try { json = txt ? JSON.parse(txt) : null; } catch { json = null; }
    return { status: r.status >= 300 && r.status < 400 ? 502 : r.status, json };
  };
}

export async function storeOnboarding(): Promise<OnboardingStore> {
  const base = await storeAdmin();
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  return {
    config: base.config, salvarConfig: base.salvarConfig, evento: base.evento,
    async criacaoPendente(empresa, desde) {
      const { data } = await db.from("fiscal_eventos").select("acao")
        .eq("empresa_id", empresa).in("acao", ["spedy_empresa_criar_inicio", "spedy_empresa_criar"])
        .gte("criado_em", desde.toISOString()).order("criado_em", { ascending: false }).limit(1);
      return data?.[0]?.acao === "spedy_empresa_criar_inicio";
    },
  };
}

import type { Database } from "@/integrations/supabase/types";

export type FichaToraPublica = Database["public"]["Functions"]["tora_publica"]["Returns"][number];

export class ErroConsultaTora extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErroConsultaTora";
  }
}

const TEMPO_LIMITE_MS = 12000;
const UUID = /^[\\da-f]{8}-[\\da-f]{4}-[\\da-f]{4}-[\\da-f]{4}-[\\da-f]{12}$/i;

/**
 * A consulta do QR é pública: não pode depender do refresh de sessão nem do
 * armazenamento de autenticação dos funcionários.
 * Utiliza exclusivamente a chave publicável, nunca service_role.
 */
export async function consultarFichaPublicaTora(
  id: string,
  options: { timeoutMs?: number; fetcher?: typeof fetch } = {},
): Promise<FichaToraPublica | null> {
  if (!UUID.test(id)) return null;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ErroConsultaTora("Sem conexão com a internet. Ative a rede e tente novamente.");
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new ErroConsultaTora("Consulta temporariamente indisponível. Tente novamente mais tarde.");
  }

  const ctrl = new AbortController();
  const tempo = setTimeout(() => ctrl.abort(), options.timeoutMs ?? TEMPO_LIMITE_MS);
  try {
    const resp = await (options.fetcher ?? fetch)(
      url.replace(/\\/+$/, "") + "/rest/v1/rpc/tora_publica",
      {
        method: "POST",
        mode: "cors",
        cache: "no-store",
        credentials: "omit",
        headers: {
          apikey: key,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ _id: id }),
        signal: ctrl.signal,
      },
    );
    if (!resp.ok) {
      console.error("[QR público] Resposta da consulta:", resp.status);
      throw new ErroConsultaTora(
        resp.status === 401 || resp.status === 403
          ? "Consulta pública indisponível. Verifique a permissão do QR."
          : "Não foi possível consultar a tora agora. Tente novamente.",
      );
    }
    const dados: unknown = await resp.json();
    if (!Array.isArray(dados)) throw new ErroConsultaTora("Resposta inesperada ao consultar a tora.");
    return (dados[0] as FichaToraPublica | undefined) ?? null;
  } catch (e) {
    if (e instanceof ErroConsultaTora) throw e;
    if (ctrl.signal.aborted) {
      throw new ErroConsultaTora("A consulta demorou demais. Verifique a conexão e tente novamente.");
    }
    console.error("[QR público] Falha de rede:", e);
    throw new ErroConsultaTora("Falha de conexão com o servidor. Tente novamente.");
  } finally {
    clearTimeout(tempo);
  }
}

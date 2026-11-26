import type { Database } from "@/integrations/supabase/types";

type FichaRpc = Database["public"]["Functions"]["tora_publica"]["Returns"][number];
export type FichaToraPublica = Omit<FichaRpc, "arrastada_em"> & {
  // Optional for snapshots and servers from before this field was added.
  arrastada_em?: string | null;
};

export class ErroConsultaTora extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErroConsultaTora";
  }
}

const TEMPO_LIMITE_MS = 12000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHAVE_COPIA = "rastreio-publico:ultima-ficha:v1";
const VALIDADE_COPIA_MS = 24 * 60 * 60 * 1000;
type CopiaPublica = { id: string; tora: FichaToraPublica; consultadaEm: number };

export function guardarFichaPublica(id: string, tora: FichaToraPublica) {
  if (!UUID.test(id)) return;
  try {
    localStorage.setItem(CHAVE_COPIA, JSON.stringify({ id: id.toLowerCase(), tora, consultadaEm: Date.now() }));
  } catch { /* Storage can be disabled; online lookup still works. */ }
}

export function lerFichaPublicaOffline(id: string): CopiaPublica | null {
  if (!UUID.test(id) || typeof navigator === "undefined" || navigator.onLine !== false) return null;
  try {
    const copia = JSON.parse(localStorage.getItem(CHAVE_COPIA) ?? "null") as CopiaPublica | null;
    if (!copia?.tora || !Number.isFinite(copia.consultadaEm)) return null;
    const idade = Date.now() - copia.consultadaEm;
    if (idade < 0 || idade > VALIDADE_COPIA_MS) {
      localStorage.removeItem(CHAVE_COPIA);
      return null;
    }
    return copia.id === id.toLowerCase() ? copia : null;
  } catch { return null; }
}

function descartarFichaPublica(id: string) {
  try {
    const copia = JSON.parse(localStorage.getItem(CHAVE_COPIA) ?? "null") as CopiaPublica | null;
    if (copia?.id === id.toLowerCase()) localStorage.removeItem(CHAVE_COPIA);
  } catch { /* SSR and browsers without local storage simply have no snapshot. */ }
}

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

  // No SSR da Lovable, a URL do banco pode ser interna à infraestrutura.
  // No navegador só a URL pública e a chave publicável são utilizadas.
  const noServidor = typeof window === "undefined" && typeof process !== "undefined";
  const url = (noServidor ? process.env['SUPABASE_URL'] : undefined)
    || import.meta.env['VITE_SUPABASE_URL'];
  const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY']
    || (noServidor ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined);
  if (!url || !key) {
    throw new ErroConsultaTora("Consulta temporariamente indisponível. Tente novamente mais tarde.");
  }

  const ctrl = new AbortController();
  const tempo = setTimeout(() => ctrl.abort(), options.timeoutMs ?? TEMPO_LIMITE_MS);
  try {
    const resp = await (options.fetcher ?? fetch)(
      url.replace(/[/]+$/, "") + "/rest/v1/rpc/tora_publica",
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
      if (resp.status === 401 || resp.status === 403) descartarFichaPublica(id);
      console.error("[QR público] Resposta da consulta:", resp.status);
      throw new ErroConsultaTora(
        resp.status === 401 || resp.status === 403
          ? "Consulta pública indisponível. Verifique a permissão do QR."
          : "Não foi possível consultar a tora agora. Tente novamente.",
      );
    }
    const dados: unknown = await resp.json();
    if (!Array.isArray(dados)) throw new ErroConsultaTora("Resposta inesperada ao consultar a tora.");
    const tora = (dados[0] as FichaToraPublica | undefined) ?? null;
    if (!tora) descartarFichaPublica(id);
    return tora;
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

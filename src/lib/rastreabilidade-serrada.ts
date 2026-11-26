import { URL_PUBLICA } from './tora-qr';

export const UUID_RASTREIO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const urlRastreioSerrado = (id: string) => `${URL_PUBLICA}/t/serrada/${id}`;

type ToraOrigem = {
  plaqueta: number; arvore: number; secao: string | null; autex: string | null;
  especie: string | null; nome_cientifico: string | null; latitude: number | null;
  longitude: number | null; talhao: string | null; abatida_em: string | null;
  arrastada_em: string | null; patio_em: string | null;
};
type Bitola = {
  especie: string; nome_cientifico: string | null; tipo_peca: string; grossura: number; largura: number;
  distribuicao_pecas: Record<string, number>; total_pecas: number; volume_m3: number;
};
type PacotePublico = {
  numero: string; data: string; autex: string | null; pmfs: string | null; poa: string | null;
  crv_percentual: number | null; itens: Bitola[]; toras: ToraOrigem[];
};
export type FichaSerrada = {
  tipo: "pacote" | "carga"; numero: string; data: string;
  empresa: { razao_social: string | null; cnpj: string | null } | null; pacotes: PacotePublico[];
};

type Copia = { ficha: FichaSerrada; consultadaEm: number };
const validade = 24 * 60 * 60 * 1000;
const chave = (id: string) => `rastreio-serrado:v1:${id.toLowerCase()}`;

export function lerCopiaSerrada(id: string): Copia | null {
  if (!UUID_RASTREIO.test(id)) return null;
  try {
    const copia: Copia | null = JSON.parse(localStorage.getItem(chave(id)) ?? "null");
    const idade = Date.now() - (copia?.consultadaEm ?? 0);
    if (copia?.ficha && Number.isFinite(idade) && idade >= 0 && idade < validade) return copia;
    localStorage.removeItem(chave(id));
  } catch { /* cópia indisponível */ }
  return null;
}

export async function consultarFichaSerrada(id: string, signal: AbortSignal): Promise<FichaSerrada | null> {
  if (!UUID_RASTREIO.test(id)) return null;
  const url = import.meta.env["VITE_SUPABASE_URL"];
  const apikey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !apikey) throw new Error("Consulta pública indisponível.");
  const resposta = await fetch(url.replace(/\/$/, "") + "/rest/v1/rpc/rastreabilidade_serrada_publica", {
    method: "POST", credentials: "omit", cache: "no-store", signal,
    headers: { apikey, "Content-Type": "application/json" },
    body: JSON.stringify({ _id: id }),
  });
  if ([401, 403, 404].includes(resposta.status)) {
    try { localStorage.removeItem(chave(id)); } catch { /* armazenamento indisponível */ }
  }
  if (!resposta.ok) throw new Error("Não foi possível carregar a ficha pública.");
  const ficha: FichaSerrada | null = await resposta.json();
  if (ficha && (!Array.isArray(ficha.pacotes) || !["pacote", "carga"].includes(ficha.tipo))) {
    throw new Error("A consulta retornou uma ficha inválida.");
  }
  if (!signal.aborted) {
    try {
      if (ficha) localStorage.setItem(chave(id), JSON.stringify({ ficha, consultadaEm: Date.now() }));
      else localStorage.removeItem(chave(id));
    } catch { /* consulta continua disponível online */ }
  }
  return ficha;
}

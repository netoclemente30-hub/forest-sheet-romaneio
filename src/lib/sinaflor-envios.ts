import type { Arvore, Tora } from "./data";

// Controle LOCAL, por usuário, empresa e AUTEX. Não substitui a confirmação do IBAMA.
export type ControleEnvios = { abatidas: string[]; tracadas: string[] };
export type TipoEnvio = keyof ControleEnvios;
const vazio = (): ControleEnvios => ({ abatidas: [], tracadas: [] });

export function chaveSinaflor(usuario: string, empresa: string, autex: string): string {
  return "gestor-sinaflor-confirmados:v1:" + [usuario, empresa, autex].map(encodeURIComponent).join(":");
}
export const idAbatida = (a: Pick<Arvore, "numero">) => String(a.numero);
export const idTracada = (t: Pick<Tora, "arvore" | "secao">) =>
  String(t.arvore) + ":" + (t.secao ?? "").trim().toUpperCase();

export function lerEnvios(chave: string): ControleEnvios {
  if (!chave || typeof window === "undefined") return vazio();
  try {
    const valor = JSON.parse(window.localStorage.getItem(chave) ?? "{}") as Partial<ControleEnvios>;
    return {
      abatidas: Array.isArray(valor.abatidas) ? valor.abatidas.filter((x): x is string => typeof x === "string") : [],
      tracadas: Array.isArray(valor.tracadas) ? valor.tracadas.filter((x): x is string => typeof x === "string") : [],
    };
  } catch { return vazio(); }
}

export function marcarEnvios(dados: ControleEnvios, tipo: TipoEnvio, ids: string[]): ControleEnvios {
  return { ...dados, [tipo]: [...new Set([...dados[tipo], ...ids])] };
}

export function gravarEnvios(chave: string, dados: ControleEnvios): void {
  if (!chave || typeof window === "undefined") throw new Error("Usuário ou empresa não identificados");
  window.localStorage.setItem(chave, JSON.stringify(dados));
}

export function pendentesDeEnvio<T>(itens: T[], marcados: string[], identificar: (item: T) => string): T[] {
  const encontrados = new Set(marcados);
  return itens.filter((item) => !encontrados.has(identificar(item)));
}

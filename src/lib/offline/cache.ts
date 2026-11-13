// Cache local de leitura (IndexedDB) para o app abrir e consultar dados sem
// internet. Sempre que uma consulta à nuvem funciona, o resultado é gravado
// aqui; sem internet, lê-se daqui.

import { idb } from "./db";
import { getEmpresaAtiva } from "@/lib/empresa";

function chave(nome: string, empresa: string | null): string {
  return `${empresa ?? "minha"}:${nome}`;
}

export async function salvarCache(nome: string, dados: unknown, empresa = getEmpresaAtiva()): Promise<void> {
  try {
    await idb.put("cache", { dados, salvoEm: Date.now() }, chave(nome, empresa));
  } catch {
    // cache é best-effort
  }
}

export async function lerCache<T>(nome: string, empresa = getEmpresaAtiva()): Promise<T[] | null> {
  try {
    const reg = await idb.get<{ dados: T[] }>("cache", chave(nome, empresa));
    return reg?.dados ?? null;
  } catch {
    return null;
  }
}

// Executa a consulta; em sucesso grava no cache, em falha tenta o cache.
export async function comCache<T>(nome: string, buscar: () => Promise<T[]>): Promise<T[]> {
  const empresa = getEmpresaAtiva();
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const cache = await lerCache<T>(nome, empresa);
    if (cache) return cache;
    console.warn("Sem internet e sem dados salvos para esta consulta; exibindo lista vazia.");
    return [];
  }
  try {
    const dados = await buscar();
    await salvarCache(nome, dados, empresa);
    return dados;
  } catch (e) {
    const cache = await lerCache<T>(nome, empresa);
    if (cache) return cache;
    throw e;
  }
}

// Cache offline protegido por identidade: nunca reutilizar a mesma chave entre
// contas que compartilharam este aparelho ou entre diferentes empresas.
import { idb } from "./db";
import { getEmpresaAtiva, lerEmpresaSalva } from "@/lib/empresa";
import { supabase } from "@/integrations/supabase/client";

async function chave(nome: string, empresa: string | null): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const usuario = data.session?.user.id;
  if (!usuario) return null;
  const contexto = empresa ?? lerEmpresaSalva(usuario) ?? "sem-vinculo";
  return usuario + ":" + contexto + ":" + nome;
}

export async function salvarCache(nome: string, dados: unknown, empresa = getEmpresaAtiva()): Promise<void> {
  try {
    const escopo = await chave(nome, empresa);
    if (!escopo) return; // Nunca guardar dados autenticados em chave anônima.
    await idb.put("cache", { dados, salvoEm: Date.now() }, escopo);
  } catch {
    // cache é best-effort; nunca interromper operações online
  }
}

export async function lerCache<T>(nome: string, empresa = getEmpresaAtiva()): Promise<T[] | null> {
  try {
    const escopo = await chave(nome, empresa);
    if (!escopo) return null;
    const reg = await idb.get<{ dados: T[] }>("cache", escopo);
    return reg?.dados ?? null;
  } catch {
    return null;
  }
}

export async function comCache<T>(nome: string, buscar: () => Promise<T[]>): Promise<T[]> {
  const empresa = getEmpresaAtiva();
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const cache = await lerCache<T>(nome, empresa);
    if (cache) return cache;
    console.warn("Sem internet e sem dados autorizados em cache para esta conta.");
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

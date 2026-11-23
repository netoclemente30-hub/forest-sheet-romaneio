// Cache offline protegido por identidade: nunca reutilizar a mesma chave entre
// contas que compartilharam este aparelho ou entre diferentes empresas.
import { idb } from "./db";
import { getEmpresaAtiva, lerEmpresaSalva } from "@/lib/empresa";
import { sessaoDoAparelho } from "./sessao";
import { comPrazo, erroDeRede, informarConexao, redeDisponivel } from "./conexao";

async function chave(nome: string, empresa: string | null): Promise<string | null> {
  const session = await sessaoDoAparelho();
  const usuario = session?.user.id;
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

export async function comCache<T>(nome: string, buscar: () => Promise<T[]>, empresa = getEmpresaAtiva()): Promise<T[]> {
  // Capture identity BEFORE starting network work; late replies cannot become another user's cache.
  const escopo = await chave(nome, empresa);
  const local = async (): Promise<T[]> => {
    try {
      if (!escopo || await chave(nome, empresa) !== escopo) return [];
      const reg = await idb.get<{ dados: T[] }>('cache', escopo);
      return reg?.dados ?? [];
    } catch { return []; }
  };
  if (!escopo) return [];
  if (!redeDisponivel()) return local();
  try {
    const dados = await comPrazo(buscar(), 10000);
    informarConexao(true);
    // Stored under the identity captured BEFORE the request (its real owner).
    try { await idb.put('cache', { dados, salvoEm: Date.now() }, escopo); }
    catch { console.warn('Consulta disponível online, mas não foi possível guardar uma cópia neste aparelho.'); }
    // A reply that arrives after the account/company changed is never shown.
    if (await chave(nome, empresa) !== escopo) return [];
    return dados;
  } catch (e) {
    if (!erroDeRede(e)) throw e; // An authorization failure is NOT permission to show stale private data.
    informarConexao(false);
    return local(); // No cached rows means an honest empty list, never invented inventory.
  }
}

// Cache offline protegido por identidade: nunca reutilizar a mesma chave entre
// contas que compartilharam este aparelho ou entre diferentes empresas.
import { idb } from "./db";
import { getEmpresaAtiva, lerEmpresaSalva } from "@/lib/empresa";
import { supabase } from "@/integrations/supabase/client";
import { fila } from './fila';
import { projetarDados } from './projecao';

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

export async function comCache<T>(nome: string, buscar: () => Promise<T[]>, empresaConsulta = getEmpresaAtiva()): Promise<T[]> {
  let empresa = empresaConsulta;
  // Start identity capture before the request; never assign its reply to a later user.
  const contexto = chave(nome, empresa);
  const escopo = await contexto;
  if (!escopo) return [];
  const empresaInicial = getEmpresaAtiva();
  const vigente = async () => getEmpresaAtiva() === empresaInicial && await chave(nome, empresaConsulta) === escopo;
  empresa = escopo.split(':')[1] === 'sem-vinculo' ? null : escopo.split(':')[1] ?? null;
  const ler = async () => {
    try { return (await idb.get<{ dados: T[] }>('cache', escopo))?.dados ?? null; }
    catch { return null; }
  };
  const projetar = async (dados: T[], ausente = false) => {
    if (!await vigente()) return [];
    let itens: Awaited<ReturnType<ReturnType<typeof fila>['listar']>> = [];
    try { itens = await fila().listar(); } catch { /* Cache reads stay available if queue fails. */ }
    if (!await vigente()) return [];
    const resultado = projetarDados(nome, dados, itens, empresa);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cache-disponibilidade', { detail: { escopo, ausente } }));
    return resultado;
  };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const cache = await ler();
    if (cache) return projetar(cache);
    console.warn("Sem internet e sem dados autorizados em cache para esta conta.");
    return projetar([], true);
  }
  try {
    if (!await vigente()) return [];
    const dados = await buscar();
    try { await idb.put('cache', { dados, salvoEm: Date.now() }, escopo); } catch { /* Read cache is best-effort, queue writes are not. */ }
    return projetar(dados);
  } catch (e) {
    const cache = await ler();
    if (cache) return projetar(cache);
    throw e;
  }
}

import { supabase } from '@/integrations/supabase/client';

let acessivel: boolean | null = null;
export function informarConexao(valor: boolean) { acessivel = valor; }
export function redeDisponivel() {
  return (typeof navigator === 'undefined' || navigator.onLine) && acessivel !== false;
}
export function erroDeRede(e: unknown): boolean {
  const x = e as { message?: string; status?: number; code?: string; name?: string } | null;
  return Boolean(x && ((x.status ?? 0) >= 500 || x.name === 'AbortError' || x.name === 'TimeoutError' ||
    /fetch|network|timeout|timed out|connection|load failed|abort|rede|sem conex|offline/i.test(x.message ?? String(e))));
}
export async function comPrazo<T>(tarefa: PromiseLike<T>, ms = 5000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve(tarefa), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Tempo de conexão esgotado (timeout)')), ms);
    })]);
  } finally { clearTimeout(timer); }
}
/** Read-only authenticated probe. navigator.onLine is only a hint. */
export async function verificarBackend(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) { informarConexao(false); return false; }
  try {
    const { data, error } = await comPrazo(supabase.rpc('minha_empresa').abortSignal(AbortSignal.timeout(5000)));
    informarConexao(!error || !erroDeRede(error));
    return !error && typeof data === "string" && data.length > 0;
  } catch { informarConexao(false); return false; }
}

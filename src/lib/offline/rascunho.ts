import { idb } from './db';
import { supabase } from '@/integrations/supabase/client';
import { getEmpresaAtiva, lerEmpresaSalva } from '@/lib/empresa';

export async function contextoLocal(empresa = getEmpresaAtiva()) {
  const { data, error } = await supabase.auth.getSession();
  const usuario = data.session?.user.id;
  if (error || !usuario) throw new Error('Entre na sua conta antes de guardar um rascunho');
  const emp = empresa ?? lerEmpresaSalva(usuario);
  if (!emp) throw new Error('Escolha uma empresa');
  return { usuario, empresa: emp };
}

/** Essential-online actions retain an explicit local draft, never pretend confirmation. */
export async function guardarRascunho(nome: string, dados: unknown, empresa?: string | null) {
  const c = await contextoLocal(empresa);
  await idb.put('cache', { dados, salvoEm: Date.now(), ...c }, `rascunho:${c.usuario}:${c.empresa}:${nome}`);
}

export async function lerRascunho<T>(nome: string, empresa?: string | null): Promise<T | null> {
  const c = await contextoLocal(empresa);
  return (await idb.get<{ dados: T }>('cache', `rascunho:${c.usuario}:${c.empresa}:${nome}`))?.dados ?? null;
}
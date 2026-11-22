import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { comPrazo } from './conexao';

/** Reuse only the SDK's existing session; never persist a second token copy. */
export function lerSessaoLocal(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = import.meta.env['VITE_SUPABASE_URL'];
    if (!url) return null;
    const ref = new URL(url).hostname.split('.')[0];
    const value: unknown = JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`) ?? 'null');
    if (!value || typeof value !== 'object' || !('user' in value) || !('access_token' in value) || !('refresh_token' in value)) return null;
    const user = value.user;
    if (!user || typeof user !== 'object' || !('id' in user) || typeof user.id !== 'string') return null;
    return value as Session;
  } catch { return null; }
}
export async function sessaoDoAparelho(): Promise<Session | null> {
  const local = lerSessaoLocal();
  if (local) return local;
  const { data, error } = await comPrazo(supabase.auth.getSession());
  if (error) throw error;
  return data.session;
}

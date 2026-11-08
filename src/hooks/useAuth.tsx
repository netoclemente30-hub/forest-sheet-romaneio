import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lerEmpresaSalva, salvarEmpresaDoUsuario } from "@/lib/empresa";

async function checarAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

async function checarSuperAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "superadmin" });
  return !!data;
}

async function checarEmpresa(): Promise<string | null> {
  const { data } = await supabase.rpc("minha_empresa");
  return (data as string | null) ?? null;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissoesCarregando, setPermissoesCarregando] = useState(true);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        Promise.all([checarAdmin(s.user.id), checarSuperAdmin(s.user.id)])
          .then(([a, sa]) => { setIsAdmin(a); setIsSuperAdmin(sa); })
          .finally(() => setPermissoesCarregando(false));
        checarEmpresa().then(setEmpresaId);
      } else {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setEmpresaId(null);
        setPermissoesCarregando(false);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      // A sessão persistida libera as telas de campo sem aguardar consultas
      // de permissões na rede. Permissões administrativas continuam verificadas.
      setLoading(false);
      if (data.session?.user) {
        setIsAdmin(await checarAdmin(data.session.user.id));
        setIsSuperAdmin(await checarSuperAdmin(data.session.user.id));
        setPermissoesCarregando(false);
        setEmpresaId(await checarEmpresa());
      } else setPermissoesCarregando(false);
     }).catch(() => { setLoading(false); setPermissoesCarregando(false); });
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, loading, permissoesCarregando, isAdmin, isSuperAdmin, empresaId };
}

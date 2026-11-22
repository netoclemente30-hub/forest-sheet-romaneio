import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { lerEmpresaSalva, salvarEmpresaDoUsuario } from '@/lib/empresa';
import { papelDoUsuario, funcaoValida, type FuncaoFuncionario } from '@/lib/funcoes';
import { lerSessaoLocal } from '@/lib/offline/sessao';
import { lerPermissoes, salvarPermissoes, invalidarPermissoes, type PermissoesSalvas } from '@/lib/offline/permissoes';
import { comPrazo, erroDeRede, informarConexao } from '@/lib/offline/conexao';

type EstadoPermissoes = 'validando' | 'validado' | 'offline' | 'indisponivel';
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [funcao, setFuncao] = useState<FuncaoFuncionario | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissoesCarregando, setPermissoesCarregando] = useState(true);
  const [estadoPermissoes, setEstadoPermissoes] = useState<EstadoPermissoes>('validando');
  useEffect(() => {
    let ativo = true;
    let versao = 0;
    let usuario: string | null = null;
    let recebeuEvento = false;
    let agendada: ReturnType<typeof setTimeout> | undefined;
    let copia: PermissoesSalvas | null = null;
    const limpar = () => { setIsAdmin(false); setIsSuperAdmin(false); setFuncao(null); };
    function aplicar(p: PermissoesSalvas) {
      setIsAdmin(p.admin); setIsSuperAdmin(p.superadmin); setFuncao(p.funcao); setEmpresaId(p.empresa);
    }
    function usarCopia(id: string) {
      copia = lerPermissoes(id, lerEmpresaSalva(id));
      if (copia) aplicar(copia);
      else { limpar(); setEmpresaId(lerEmpresaSalva(id)); }
      setEstadoPermissoes(copia ? 'offline' : 'indisponivel');
      setPermissoesCarregando(false);
    }
    async function consultar<T>(nome: string, args?: Record<string, unknown>): Promise<T> {
      const { data, error } = await comPrazo((args ? supabase.rpc(nome as never, args as never) : supabase.rpc(nome as never)));
      if (error) throw error;
      return data as T;
    }
    async function atualizar(id: string, atual: number) {
      const vigente = () => ativo && usuario === id && versao === atual;
      if (!navigator.onLine) { usarCopia(id); return; }
      // Restore confirmed permissions immediately, even if Wi-Fi has no internet.
      // Each successful revalidation replaces the entire snapshot, including null roles.
      const empresaPromise = consultar<string | null>('minha_empresa');
      void empresaPromise.then(empresa => {
        if (!vigente()) return;
        if (empresa) { salvarEmpresaDoUsuario(id, empresa); setEmpresaId(empresa); }
      }).catch(() => {});
      try {
        const [empresa, admin, superadmin, cargo] = await Promise.all([
          empresaPromise,
          consultar<boolean>('has_role', { _user_id: id, _role: 'admin' }),
          consultar<boolean>('has_role', { _user_id: id, _role: 'superadmin' }),
          consultar<unknown>('minha_funcao'),
        ]);
        if (!vigente()) return;
        informarConexao(true);
        invalidarPermissoes(id); // revoke old company/role snapshots before replacement
        copia = empresa ? { usuario: id, empresa, admin: admin === true, superadmin: superadmin === true,
          funcao: funcaoValida(cargo) ? cargo : null, validadoEm: Date.now() } : null;
        if (copia) { salvarEmpresaDoUsuario(id, copia.empresa); salvarPermissoes(copia); aplicar(copia); }
        else { limpar(); setEmpresaId(null); }
        setEstadoPermissoes('validado');
      } catch (e) {
        if (!vigente()) return;
        if (erroDeRede(e)) { informarConexao(false); usarCopia(id); }
        else { invalidarPermissoes(id); copia = null; limpar(); setEmpresaId(null); setEstadoPermissoes('indisponivel'); }
      } finally { if (vigente()) setPermissoesCarregando(false); }
    }
    function receberSessao(s: Session | null, revogada = false) {
      if (!ativo) return;
      clearTimeout(agendada);
      const atual = ++versao;
      const id = s?.user.id ?? null;
      if (revogada && usuario) invalidarPermissoes(usuario);
      if (id !== usuario) {
        limpar(); copia = null; setEmpresaId(lerEmpresaSalva(id));
        setPermissoesCarregando(Boolean(id));
        if (id) usarCopia(id);
      }
      usuario = id; setSession(s); setLoading(false);
      if (!id) { setEmpresaId(null); setPermissoesCarregando(false); }
      else agendada = setTimeout(() => { void atualizar(id, atual); }, 0);
    }
    // The SDK may try refreshing an expired token before getSession resolves.
    // Read its existing local session without waiting; never reconstruct credentials.
    const local = lerSessaoLocal();
    if (local) receberSessao(local);
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      recebeuEvento = true;
      if (!s && evento !== 'SIGNED_OUT' && local) return;
      receberSessao(s, evento === 'SIGNED_OUT');
    });
    void comPrazo(supabase.auth.getSession()).then(({ data }) => {
      if (!recebeuEvento && !local) receberSessao(data.session);
    }).catch(() => { if (ativo && !recebeuEvento && !local) receberSessao(null); });
    const reconectar = () => {
      if (!usuario || document.visibilityState === 'hidden') return;
      clearTimeout(agendada);
      void atualizar(usuario, ++versao);
    };
    window.addEventListener('online', reconectar);
    window.addEventListener('focus', reconectar);
    document.addEventListener('visibilitychange', reconectar);
    const timer = setInterval(reconectar, 30000);
    return () => {
      ativo = false; clearTimeout(agendada); clearInterval(timer);
      window.removeEventListener('online', reconectar); window.removeEventListener('focus', reconectar);
      document.removeEventListener('visibilitychange', reconectar); data.subscription.unsubscribe();
    };
  }, []);
  const papel = papelDoUsuario(isSuperAdmin, isAdmin, funcao);
  return { session, loading, permissoesCarregando, estadoPermissoes, isAdmin, isSuperAdmin, empresaId, funcao, papel };
}

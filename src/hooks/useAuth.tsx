import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lerEmpresaSalva, salvarEmpresaDoUsuario } from "@/lib/empresa";
import { papelDoUsuario, funcaoValida, type FuncaoFuncionario } from "@/lib/funcoes";

async function checarAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw error;
  return data === true;
}

async function checarSuperAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "superadmin" });
  if (error) throw error;
  return data === true;
}

/** A função é sempre consultada no banco; metadados editáveis do usuário não autorizam ações. */
async function checarFuncao(): Promise<FuncaoFuncionario | null> {
  const { data, error } = await supabase.rpc("minha_funcao" as never);
  if (error) return null; // Antes da ativação do banco: negar acesso operacional.
  return funcaoValida(data) ? data : null;
}

async function checarEmpresa(): Promise<string | null> {
  const { data, error } = await supabase.rpc("minha_empresa");
  if (error) throw error;
  return (data as string | null) ?? null;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [funcao, setFuncao] = useState<FuncaoFuncionario | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissoesCarregando, setPermissoesCarregando] = useState(true);
  useEffect(() => {
    let ativo = true;
    let versao = 0;
    let usuario: string | null = null;
    let recebeuEvento = false;
    let agendada: ReturnType<typeof setTimeout> | undefined;
    let tentativa: ReturnType<typeof setTimeout> | undefined;

    function atualizar(id: string, atual: number) {
      const vigente = () => ativo && usuario === id && versao === atual;
      setPermissoesCarregando(true);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setFuncao(null);
      // Cópia por usuário apenas para trabalhar sem sinal. O servidor continua
      // validando o cargo atual ao sincronizar; nunca autoriza pela cópia local.
      if (!navigator.onLine) {
        try {
          const salva = JSON.parse(localStorage.getItem("permissoes-offline:" + id) ?? "null");
          if (salva?.usuario === id) {
            setIsAdmin(salva.admin === true);
            setIsSuperAdmin(salva.superadmin === true);
            setFuncao(funcaoValida(salva.funcao) ? salva.funcao : null);
          }
        } catch { /* sem cópia válida: negar */ }
        setEmpresaId(lerEmpresaSalva(id));
        setPermissoesCarregando(false);
        return;
      }
      // Empresa e permissões são independentes: uma consulta lenta de cargo
      // não pode impedir lançamentos de campo.
      void checarEmpresa().catch(() => null).then((empresa) => {
        if (!vigente()) return;
        const salva = empresa ?? lerEmpresaSalva(id);
        if (empresa) salvarEmpresaDoUsuario(id, empresa);
        setEmpresaId(salva);
        if (!salva) tentativa = setTimeout(() => {
          if (vigente()) atualizar(id, atual);
        }, 10000);
      });
      void Promise.all([checarAdmin(id), checarSuperAdmin(id), checarFuncao()])
        .then(([a, sa, f]) => { if (vigente()) { setIsAdmin(a); setIsSuperAdmin(sa); setFuncao(f); try { localStorage.setItem("permissoes-offline:" + id, JSON.stringify({ usuario: id, admin: a, superadmin: sa, funcao: f })); } catch { /* armazenamento indisponível */ } } })
        .catch(() => { if (vigente()) { setIsAdmin(false); setIsSuperAdmin(false); setFuncao(null); } })
        .finally(() => { if (vigente()) setPermissoesCarregando(false); });
    }

    function receberSessao(s: Session | null) {
      if (!ativo) return;
      clearTimeout(agendada);
      clearTimeout(tentativa);
      const atual = ++versao;
      const id = s?.user.id ?? null;
      if (id !== usuario) { setIsAdmin(false); setIsSuperAdmin(false); setFuncao(null); }
      usuario = id;
      setSession(s);
      setLoading(false);
      setEmpresaId(lerEmpresaSalva(id));
      setPermissoesCarregando(Boolean(id));
      if (id) {
        // O aviso de autenticação mantém o lock da sessão até retornar.
        // Adiar as consultas evita que esperem pelo próprio aviso de login.
        agendada = setTimeout(() => atualizar(id, atual), 0);
      }
    }

    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      recebeuEvento = true;
      receberSessao(s);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!recebeuEvento) receberSessao(data.session);
    }).catch(() => { if (ativo && !recebeuEvento) receberSessao(null); });
    const reconectar = () => {
      if (!usuario) return;
      clearTimeout(agendada);
      clearTimeout(tentativa);
      atualizar(usuario, ++versao);
    };
    window.addEventListener("online", reconectar);
    return () => {
      ativo = false;
      clearTimeout(agendada);
      clearTimeout(tentativa);
      window.removeEventListener("online", reconectar);
      data.subscription.unsubscribe();
    };
  }, []);
  const papel = papelDoUsuario(isSuperAdmin, isAdmin, funcao);
  return { session, loading, permissoesCarregando, isAdmin, isSuperAdmin, empresaId, funcao, papel };
}

import { LogoGestor } from "@/components/LogoGestor";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const WHATS_ACESSO =
  "https://wa.me/5569996109506?text=Ol%C3%A1%20Neto%2C%20quero%20um%20acesso%20ao%20aplicativo%20Manejo%20Florestal.";

/**
 * Formulário de acesso reutilizável: usado pela tela de login antiga e pelo
 * diálogo "Acessar sistema" da página de apresentação.
 */
export function FormularioLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [semAcesso, setSemAcesso] = useState(false);

  useEffect(() => {
    // Conta Google sem acesso liberado volta com erro na URL.
    const txt = window.location.search + window.location.hash;
    if (/error/i.test(txt)) {
      setSemAcesso(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error("E-mail ou senha incorretos");
    else sessionStorage.setItem("login-pendente", "1");
    setBusy(false);
  }

  async function google() {
    sessionStorage.setItem("login-pendente", "1");
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + window.location.pathname });
    if (r.error) setSemAcesso(true);
  }

  return (
    <div className="space-y-4">
      <LogoGestor className="mx-auto size-16" alt="Gestor Florestal" />
      {semAcesso && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 space-y-3">
          <p className="font-semibold">Esta conta ainda não tem acesso.</p>
          <p className="text-sm text-muted-foreground">O acesso é liberado pelo administrador. Peça o seu pelo WhatsApp.</p>
          <Button asChild size="lg" className="w-full h-12">
            <a href={WHATS_ACESSO} target="_blank" rel="noreferrer">Pedir acesso pelo WhatsApp</a>
          </Button>
        </div>
      )}
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pw">Senha</Label>
          <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
        </div>
        <Button type="submit" size="lg" className="w-full h-12" disabled={busy}>
          Entrar
        </Button>
      </form>
      {import.meta.env.MODE !== "android" && <Button variant="outline" size="lg" className="w-full h-12" onClick={google}>
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
        Continuar com Google
      </Button>}
      <p className="text-sm text-muted-foreground text-center">
        Não tem acesso?{" "}
        <a className="text-primary font-semibold underline" href={WHATS_ACESSO} target="_blank" rel="noreferrer">
          Peça pelo WhatsApp
        </a>
      </p>
    </div>
  );
}

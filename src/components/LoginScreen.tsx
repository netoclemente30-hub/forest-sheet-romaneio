import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trees } from "lucide-react";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error("E-mail ou senha incorretos");
    setBusy(false);
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Não foi possível entrar com Google");
  }

  return (
    <div className="min-h-screen bg-forest flex flex-col justify-end sm:justify-center">
      <div className="px-6 pb-8 pt-16 text-primary-foreground">
        <Trees className="size-12 mb-3 text-accent" />
        <h1 className="text-5xl font-bold uppercase leading-none">Manejo<br />Florestal</h1>
        <p className="mt-2 opacity-80">Inventário, toras e romaneios de carga</p>
      </div>
      <div className="bg-card rounded-t-3xl sm:rounded-3xl sm:mx-auto sm:w-full sm:max-w-sm p-6 space-y-4">
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
        <Button variant="outline" size="lg" className="w-full h-12" onClick={google}>
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
          Continuar com Google
        </Button>
        <p className="text-sm text-muted-foreground text-center">
          Não tem acesso?{" "}
          <a
            className="text-primary font-semibold underline"
            href="https://wa.me/5569999004121?text=Ol%C3%A1%20Neto%2C%20quero%20um%20acesso%20ao%20aplicativo%20Manejo%20Florestal."
            target="_blank"
            rel="noreferrer"
          >
            Peça pelo WhatsApp
          </a>
        </p>
      </div>
    </div>
  );
}

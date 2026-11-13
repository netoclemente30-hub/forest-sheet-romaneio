import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cadastrarEmpresaPublica } from "@/lib/usuarios.functions";
import { cnpjValido, formatarCnpj, LIMITE_DEMONSTRACAO } from "@/lib/cnpj";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Cadastro de nova empresa em demonstração (nome + CNPJ + acesso). */
export function FormularioCadastro({ onEntrar }: { onEntrar: () => void }) {
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cnpjValido(cnpj)) { toast.error("CNPJ inválido"); return; }
    setBusy(true);
    try {
      await cadastrarEmpresaPublica({ data: { nome, cnpj, email, password: senha } });
      sessionStorage.setItem("login-pendente", "1");
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
      if (error) { toast.success("Empresa cadastrada. Entre com seu e-mail e senha."); onEntrar(); }
      else toast.success(`Cadastro enviado! Assim que for liberado, você usa a demonstração de ${LIMITE_DEMONSTRACAO} toras.`);
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="cad-nome">Nome da empresa</Label>
        <Input id="cad-nome" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} className="h-12" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cad-cnpj">CNPJ</Label>
        <Input id="cad-cnpj" required inputMode="numeric" placeholder="00.000.000/0000-00" value={cnpj} onChange={(e) => setCnpj(formatarCnpj(e.target.value))} className="h-12" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cad-email">E-mail de acesso</Label>
        <Input id="cad-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cad-senha">Senha</Label>
        <Input id="cad-senha" type="password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} className="h-12" />
      </div>
      <Button type="submit" size="lg" className="w-full h-12" disabled={busy}>
        {busy ? "Cadastrando…" : "Cadastrar e começar"}
      </Button>
      <p className="text-sm text-muted-foreground text-center">
        Já tem acesso?{" "}
        <button type="button" className="text-primary font-semibold underline" onClick={onEntrar}>Entrar</button>
      </p>
    </form>
  );
}

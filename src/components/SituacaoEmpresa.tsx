import { useQuery } from "@tanstack/react-query";
import { comCache } from "@/lib/offline/cache";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { WHATS_ACESSO } from "@/components/FormularioLogin";

export type Situacao = { status: string; toras: number; limite: number } | null;

export function useSituacaoEmpresa(ativo: boolean) {
  return useQuery({
    queryKey: ["situacao-empresa"],
    enabled: ativo,
    networkMode: "always",
    staleTime: 60_000,
    queryFn: async (): Promise<Situacao> => {
      const rows = await comCache<NonNullable<Situacao>>('situacao-empresa', async () => {
        const { data, error } = await supabase.rpc("minha_empresa_situacao");
        if (error) throw error;
        return data ?? [];
      });
      return rows[0] ?? null;
    },
  });
}

export function EmpresaInativa({ sair, pendente }: { sair: () => void; pendente?: boolean }) {
  return (
    <div className="min-h-screen bg-forest text-primary-foreground grid place-items-center p-6">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="font-display text-3xl font-bold uppercase">{pendente ? "Aguardando liberação" : "Acesso suspenso"}</h1>
        <p className="opacity-90">{pendente ? "Seu cadastro foi recebido. O administrador foi avisado e vai liberar a demonstração de 50 toras." : "O acesso desta empresa está inativo. Fale com o administrador para liberar."}</p>
        <Button asChild size="lg" className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent/90">
          <a href={WHATS_ACESSO} target="_blank" rel="noreferrer">{pendente ? "Avisar pelo WhatsApp" : "Pedir liberação pelo WhatsApp"}</a>
        </Button>
        <Button variant="ghost" onClick={sair}>Sair</Button>
      </div>
    </div>
  );
}

export function AvisoDemonstracao({ s }: { s: NonNullable<Situacao> }) {
  const esgotou = s.toras >= s.limite;
  return (
    <div role="status" className={`no-print mb-4 rounded-lg border p-3 text-sm ${esgotou ? "border-destructive/40 bg-destructive/10" : "bg-muted"}`}>
      <p className="font-semibold">
        {esgotou ? "Limite da demonstração atingido" : "Modo demonstração"} — {Math.min(s.toras, s.limite)} de {s.limite} toras
      </p>
      <p className="text-muted-foreground">
        {esgotou ? "Novas toras ficam travadas até a liberação do acesso completo. A ficha de campo continua liberada." : "Você pode importar a ficha de campo completa."}{" "}
        <a className="font-semibold text-primary underline" href={WHATS_ACESSO} target="_blank" rel="noreferrer">Pedir liberação</a>
      </p>
    </div>
  );
}

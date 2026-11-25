import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CoreLocal } from "./CoreLocal";
import { useAuth } from "@/hooks/useAuth";
import { pode } from "@/lib/funcoes";
import { supabase } from "@/integrations/supabase/client";
import { FormularioLogin, WHATS_ACESSO } from "@/components/FormularioLogin";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  CloudOff,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Map,
  MapPin,
  Ruler,
  ShieldAlert,
  TreePine,
  Users,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const abas = [
  { id: "painel", nome: "Painel", icone: LayoutDashboard },
  { id: "clientes", nome: "Clientes", icone: Users },
  { id: "propriedades", nome: "Propriedades", icone: MapPin },
  { id: "projetos", nome: "Projetos", icone: FolderOpen },
  { id: "inventario", nome: "Inventário", icone: TreePine },
  { id: "mapas", nome: "Mapas", icone: Map },
  { id: "volumetria", nome: "Volumetria", icone: Ruler },
  { id: "estatisticas", nome: "Estatísticas", icone: BarChart3 },
  { id: "pmfs-poa", nome: "PMFS/POA", icone: ClipboardList },
  { id: "relatorios", nome: "Relatórios", icone: FileText },
  { id: "sincronizacao", nome: "Sincronização", icone: CloudOff },
] as const;

export function EngenheiroPagina() {
  const [aba, setAba] = useState("painel");
  const { session, loading, permissoesCarregando, estadoPermissoes, papel } = useAuth();
  const navegar = useNavigate();

  async function sairEIrParaInicio() {
    await supabase.auth.signOut();
    await navegar({ to: "/" });
  }

  if (loading || (session && permissoesCarregando && estadoPermissoes === "validando")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Carregando acesso...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <TreePine className="size-8 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h1 className="font-display text-2xl font-bold uppercase text-primary">
                Área do Engenheiro
              </h1>
              <p className="text-xs text-muted-foreground">
                Gestor Florestal · Planejamento e Inventário 100%
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Entre com sua conta Gestor Florestal. Após o primeiro acesso online, o módulo funciona
            100% offline em campo.
          </p>
          <FormularioLogin />
          <div className="pt-2 text-center">
            <Link to="/" className="text-xs text-muted-foreground underline">
              Voltar ao início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!pode(papel, "engenheiro_acessar")) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
          <ShieldAlert className="mx-auto size-10 text-destructive" aria-hidden="true" />
          <h1 className="font-display text-2xl font-bold uppercase">Módulo não liberado</h1>
          <p className="text-sm text-muted-foreground">
            A conta <strong>{session.user.email}</strong> ainda não possui licença ativa para a Área
            do Engenheiro Florestal.
          </p>
          <Button asChild size="lg" className="h-12 w-full">
            <a href={WHATS_ACESSO} target="_blank" rel="noreferrer">
              Solicitar liberação pelo WhatsApp
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void sairEIrParaInicio()}
          >
            Sair desta conta
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-forest text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <TreePine className="size-8 shrink-0 text-accent" aria-hidden="true" />
            <div>
              <p className="font-display text-xl font-bold uppercase">Gestor Florestal</p>
              <p className="text-xs tracking-wide opacity-80">
                Planejamento e inventário florestal · {session.user.email}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-current/30 px-4 text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-2"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Início
            </Link>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 gap-2 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
              onClick={() => void sairEIrParaInicio()}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Espaço de trabalho
            </p>
            <h1 className="font-display text-4xl font-bold uppercase text-primary sm:text-5xl">
              Área do Engenheiro
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Do levantamento de campo ao planejamento do manejo florestal.
            </p>
          </div>
          <span className="rounded-full border bg-muted px-3 py-1.5 text-xs font-medium">
            {estadoPermissoes === "offline" ? "Modo offline ativo (campo)" : "Conta verificada · Dados locais"}
          </span>
        </div>
        <Tabs value={aba} onValueChange={setAba} className="space-y-5">
          <TabsList
            aria-label="Módulos da Área do Engenheiro"
            className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border bg-card p-2 sm:grid-cols-3 lg:grid-cols-6"
          >
            {abas.map(({ id, nome, icone: Icone }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="min-h-12 justify-start gap-2 whitespace-normal text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Icone className="size-4 shrink-0" aria-hidden="true" />
                {nome}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={aba} className="rounded-2xl border bg-card p-4 sm:p-8">
            <h2 className="mb-4 font-display text-2xl font-bold uppercase">
              {abas.find((a) => a.id === aba)?.nome}
            </h2>
            <CoreLocal aba={aba} />
          </TabsContent>
        </Tabs>
        <p className="mt-5 text-xs text-muted-foreground">
          Planejamento sujeito à revisão do responsável técnico. Não emite autorizações e não envia
          dados ao órgão ambiental.
        </p>
      </main>
    </div>
  );
}
import { Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, ClipboardList, CloudOff, FileText, FolderOpen, LayoutDashboard, Map, MapPin, Ruler, TreePine, Users } from "lucide-react";
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

/** Public layout preview only. No credentials, customer data or operational providers. */
export function EngenheiroPagina() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-forest text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <TreePine className="size-8 shrink-0 text-accent" aria-hidden="true" />
            <div><p className="font-display text-xl font-bold uppercase">Gestor Florestal</p><p className="text-xs tracking-wide opacity-80">Planejamento e inventário florestal</p></div>
          </div>
          <Link to="/apresentacao" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-current/30 px-4 text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-2"><ArrowLeft className="size-4" aria-hidden="true" />Voltar à apresentação</Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Espaço de trabalho</p><h1 className="font-display text-4xl font-bold uppercase text-primary sm:text-5xl">Área do Engenheiro</h1><p className="mt-3 max-w-xl text-sm text-muted-foreground">Do levantamento de campo ao planejamento do manejo florestal.</p></div>
          <span className="rounded-full border bg-muted px-3 py-1.5 text-xs font-medium">Em preparação</span>
        </div>
        <Tabs defaultValue="painel" className="space-y-5">
          <TabsList aria-label="Módulos da Área do Engenheiro" className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border bg-card p-2 sm:grid-cols-3 lg:grid-cols-6">
            {abas.map(({ id, nome, icone: Icone }) => <TabsTrigger key={id} value={id} className="min-h-12 justify-start gap-2 whitespace-normal text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Icone className="size-4 shrink-0" aria-hidden="true" />{nome}</TabsTrigger>)}
          </TabsList>
          {abas.map(({ id, nome, icone: Icone }) => (
            <TabsContent key={id} value={id} className="rounded-2xl border bg-card p-6 sm:p-10">
              <h2 className="font-display text-2xl font-bold uppercase">{nome}</h2>
              <div className="flex min-h-64 flex-col items-center justify-center py-10 text-center">
                <div className="mb-5 rounded-2xl bg-muted p-5"><Icone className="size-8 text-primary" aria-hidden="true" /></div>
                <h3 className="text-lg font-semibold">{id === "sincronizacao" ? "Sincronização ainda não disponível" : "Seu espaço começa aqui"}</h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">{id === "sincronizacao" ? "A coleta offline e o envio seguro serão habilitados nas próximas etapas." : "Esta aba está preparada para receber as próximas funcionalidades. Ainda não há cadastros ou dados nesta área."}</p>
              </div>
            </TabsContent>
          ))}
        </Tabs>
        <p className="mt-5 text-xs text-muted-foreground">Prévia do layout. Cadastros e acesso profissional serão disponibilizados após a configuração das permissões.</p>
      </main>
    </div>
  );
}

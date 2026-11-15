import { Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { Home, BarChart3, LogOut, TreePine, Factory, Users, Building2, ClipboardList, Download, Check, Smartphone, MapPinned, Truck, Scissors, Warehouse } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "./ui/input";
import { registrarLogin } from "@/lib/registro";
import { nomeAparelho, salvarNomeAparelho, detectarModelo } from "@/lib/aparelho";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSituacaoEmpresa, EmpresaInativa, AvisoDemonstracao } from "@/components/SituacaoEmpresa";
import { ApresentacaoPagina } from "@/components/apresentacao/ApresentacaoPagina";
import { supabase } from "@/integrations/supabase/client";
import { listarEmpresas } from "@/lib/usuarios.functions";
import { getEmpresaAtiva, setEmpresaAtiva } from "@/lib/empresa";
import { SyncStatus } from "./SyncStatus";
import { useInstallApp } from "@/hooks/useInstallApp";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { MANEJO, emManejo, emSerraria, ehRotaPublica } from "@/lib/nav";
import { nomePapel, pode, rotaInicial, rotaPermitida, type Papel } from "@/lib/funcoes";
import { EscolherAparencia } from "@/components/Aparencia";

const nav = [
  { to: "/", label: "Início", icon: Home },
  { to: "/base", label: "Manejo", icon: TreePine },
  { to: "/serraria", label: "Serraria", icon: Factory },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
] as const;

const navPorPapel = (papel: Papel) => {
  const inicio = { to: "/" as const, label: "Início", icon: Home };
  const mapa = { to: "/cortador" as const, label: "Mapa", icon: MapPinned };
  const toras = { to: "/toras" as const, label: "Toras", icon: Scissors };
  const patios = { to: "/explanadas" as const, label: "Explanadas", icon: Warehouse };
  const carga = { to: "/romaneio" as const, label: "Carregar", icon: Truck };
  const serraria = { to: "/serraria" as const, label: "Serraria", icon: Factory };
  const relatorios = { to: "/relatorios" as const, label: "Relatórios", icon: BarChart3 };
  const registros = { to: "/registros" as const, label: "Registros", icon: ClipboardList };
  if (papel === "superadmin" || papel === "admin_empresa")
    return [...nav, registros, { to: "/usuarios" as const, label: "Usuários", icon: Users }];
  if (papel === "cortador" || papel === "tratorista") return [mapa];
  if (papel === "romaneador") return [toras, patios, mapa];
  if (papel === "motorista") return [carga, { to: "/historico" as const, label: "Cargas", icon: Truck }];
  if (papel === "gerente_patio") return [serraria, relatorios];
  if (papel === "gerente_escritorio") return [...nav, registros];
  return [inicio];
};

export function AppShell() {
  const installation = useInstallApp();
  const { session, loading, isSuperAdmin, papel, permissoesCarregando } = useAuth();
  const qc = useQueryClient();
  const contaAnterior = useRef<string | null>(null);
  // React Query mantém dados em memória mesmo depois de logout/troca de usuário.
  useEffect(() => {
    const atual = session?.user.id ?? null;
    if (contaAnterior.current !== atual) {
      qc.clear();
      setEmpresaAtiva(null);
      setEmpresaSel("");
      contaAnterior.current = atual;
    }
  }, [session?.user.id, qc]);
  async function sair() {
    const { error } = await supabase.auth.signOut();
    if (error) { toast.error(error.message); return; }
    qc.clear();
    setEmpresaAtiva(null);
    setEmpresaSel("");
  }
  const [empresaSel, setEmpresaSel] = useState<string>(() => getEmpresaAtiva() ?? "");
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const manejo = emManejo(pathname);
  const serraria = emSerraria(pathname);
  const [aparelhoAberto, setAparelhoAberto] = useState(false);
  const [nomeAp, setNomeAp] = useState("");
  const [modeloAp, setModeloAp] = useState("");
  useEffect(() => {
    if (session && sessionStorage.getItem("login-pendente")) {
      sessionStorage.removeItem("login-pendente");
      void registrarLogin();
    }
  }, [session]);
  async function abrirAparelho() {
    setNomeAp(nomeAparelho() ?? "");
    setAparelhoAberto(true);
    setModeloAp(await detectarModelo());
  }
  async function salvarAparelho() {
    await salvarNomeAparelho(nomeAp);
    setAparelhoAberto(false);
    toast.success(navigator.onLine ? "Nome do aparelho salvo." : "Nome salvo neste aparelho.");
  }
  const empresas = useQuery({ queryKey: ["empresas"], queryFn: () => listarEmpresas(), enabled: isSuperAdmin });
  const situacao = useSituacaoEmpresa(Boolean(session) && !isSuperAdmin);
  // Páginas públicas (QR da tora e apresentação) abrem sem login.
  if (ehRotaPublica(pathname)) return <Outlet />;
  if (loading) return <div className="min-h-screen bg-forest" />;
  if (session && permissoesCarregando) return <div className="min-h-screen bg-forest" />;
  // Quem ainda não entrou vê a apresentação do app e abre o login em "Acessar sistema".
  if (!session) return <ApresentacaoPagina />;
  if (!isSuperAdmin && (situacao.data?.status === "inativa" || situacao.data?.status === "pendente")) return <EmpresaInativa pendente={situacao.data.status === "pendente"} sair={sair} />;
  const items = navPorPapel(papel);
  const acessoPermitido = rotaPermitida(papel, pathname);
  const somenteLeitura = papel === "gerente_escritorio";
  const abasManejo = MANEJO.filter((m) => rotaPermitida(papel, m.to));
  return (
    <div className="min-h-screen pb-20">
      <header className="no-print bg-forest text-forest-foreground px-4 py-3 flex flex-wrap items-center justify-between gap-2 sticky top-0 z-20">
        <span className="font-display text-xl font-bold uppercase min-w-0">GESTOR FLORESTAL{"\n"}</span>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <EscolherAparencia />
          <Button size="icon" variant="ghost" aria-label="Este aparelho" title="Este aparelho" onClick={abrirAparelho} className="opacity-80">
            <Smartphone className="size-5" />
          </Button>
          <Dialog open={aparelhoAberto} onOpenChange={setAparelhoAberto}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Este aparelho</DialogTitle>
                <DialogDescription>O nome aparece nos registros de login e de operações feitos neste aparelho.</DialogDescription>
              </DialogHeader>
              <Input aria-label="Nome do aparelho" placeholder="Ex.: Tablet do pátio" value={nomeAp} maxLength={60} onChange={(e) => setNomeAp(e.target.value)} className="h-11" />
              <p className="text-sm text-muted-foreground">Modelo detectado: {modeloAp || "…"}</p>
              <Button onClick={salvarAparelho}>Salvar</Button>
            </DialogContent>
          </Dialog>
          <Button size="icon" variant="ghost" aria-label="Sair" title="Sair" onClick={() => void sair()} className="opacity-80">
            <LogOut className="size-5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={installation.install} disabled={installation.installed || installation.busy}>
            {installation.installed ? <Check /> : <Download />}
            {installation.installed ? "App instalado" : installation.busy ? "Instalando…" : "Instalar app"}
          </Button>
        </div>
        {isSuperAdmin && (empresas.data ?? []).some((e) => e.status === "pendente") && (
          <Link to="/usuarios" className="basis-full rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground">
            🔔 {(empresas.data ?? []).filter((e) => e.status === "pendente").length} novo(s) cadastro(s) aguardando liberação
          </Link>
        )}
        {isSuperAdmin && (
          <div className="flex items-center gap-1 min-w-0 basis-full">
            <Building2 className="size-4 shrink-0 opacity-80" />
            <select
              aria-label="Empresa que você está visualizando"
              className="h-9 max-w-40 truncate rounded-md border border-primary-foreground/30 bg-forest px-2 text-sm"
              value={empresaSel}
              onChange={async (e) => {
                const proxima = e.target.value;
                await qc.cancelQueries({ predicate: (q) => q.queryKey[0] !== "empresas" });
                qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "empresas" });
                setEmpresaAtiva(proxima || null);
                setEmpresaSel(proxima);
                void qc.invalidateQueries();
              }}
            >
              <option value="">Todas as empresas</option>
              {(empresas.data ?? []).map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </div>
        )}
      </header>
      <Dialog open={installation.helpOpen} onOpenChange={installation.setHelpOpen}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-lg">
          <DialogHeader>
            <DialogTitle>Instalar Manejo Florestal</DialogTitle>
            <DialogDescription>
              {installation.preview
                ? "Abra o aplicativo publicado no navegador do celular para instalar."
                : installation.ios
                  ? "No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início."
                  : "No menu do Chrome ou Edge, escolha Instalar aplicativo ou Adicionar à tela inicial. Se a opção não aparecer, abra o aplicativo conectado à internet e tente novamente."}
            </DialogDescription>
          </DialogHeader>
          {installation.preview && <Button asChild><a href="https://forest-sheet-romaneio.lovable.app" target="_blank" rel="noopener noreferrer">Abrir aplicativo</a></Button>}
        </DialogContent>
      </Dialog>
      <SyncStatus />
      <main className="mx-auto max-w-3xl p-4">
        {manejo && (
          <nav aria-label="Manejo" className="no-print mb-4 flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {abasManejo.map((m) => {
              const ativo = pathname === m.to || pathname.startsWith(`${m.to}/`) || (m.to === "/romaneio" && pathname.startsWith("/historico"));
              return (
                <Link key={m.to} to={m.to} data-ativo={ativo} className="min-w-0 flex-1 rounded-md px-1 py-2 text-center text-xs leading-tight text-muted-foreground data-[ativo=true]:bg-background data-[ativo=true]:font-semibold data-[ativo=true]:text-foreground data-[ativo=true]:shadow-sm">
                  {m.label}
                </Link>
              );
            })}
          </nav>
        )}
        {!isSuperAdmin && situacao.data?.status === "demonstracao" && <AvisoDemonstracao s={situacao.data} />}
        <div className="mb-3 text-xs text-muted-foreground">Função: <strong>{nomePapel(papel)}</strong></div>
        {somenteLeitura && <p role="status" className="mb-3 rounded-md border p-2 text-sm">
          Modo consulta: você pode visualizar informações, registros e gerar relatórios, mas não alterar lançamentos nem reverter operações.
        </p>}
        {papel === "sem_funcao" ? (
          <div role="alert" className="rounded-xl border p-4 text-sm">
            Sua conta ainda não tem uma função atribuída. Solicite ao administrador da empresa que defina seu cargo.
          </div>
        ) : !acessoPermitido && pathname === "/" ? (
          <Navigate to={rotaInicial(papel)} replace />
        ) : !acessoPermitido ? (
          <div role="alert" className="rounded-xl border p-4 space-y-2 text-sm">
            <strong>Acesso restrito para {nomePapel(papel)}.</strong>
            <p>Esta página não faz parte das permissões do seu cargo.</p>
            <Link to={rotaInicial(papel)} className="text-primary underline">Voltar para minha área</Link>
          </div>
        ) : (
          <div key={empresaSel}>
            <Outlet />
          </div>
        )}
      </main>
      <nav className="no-print fixed bottom-0 inset-x-0 bg-card border-t z-20">
        <div className="mx-auto max-w-3xl grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              data-manejo={to === "/base" && manejo}
              data-serraria={to === "/serraria" && serraria}
              className="flex min-w-0 flex-col items-center gap-0.5 px-0.5 py-2.5 text-center text-[11px] leading-tight text-muted-foreground data-[status=active]:text-primary data-[status=active]:font-semibold data-[manejo=true]:text-primary data-[manejo=true]:font-semibold data-[serraria=true]:text-primary data-[serraria=true]:font-semibold"
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

import { Link, Outlet } from "@tanstack/react-router";
import { Home, Layers, Truck, History, LogOut, TreePine, Warehouse, Factory, Users, Building2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";
import { LoginScreen } from "./LoginScreen";
import { supabase } from "@/integrations/supabase/client";
import { listarEmpresas } from "@/lib/usuarios.functions";
import { getEmpresaAtiva, setEmpresaAtiva } from "@/lib/empresa";
import { SyncStatus } from "./SyncStatus";

const nav = [
  { to: "/", label: "Início", icon: Home },
  { to: "/base", label: "Base", icon: TreePine },
  { to: "/toras", label: "Toras", icon: Layers },
  { to: "/estoque", label: "Estoque", icon: Warehouse },
  { to: "/romaneio", label: "Romaneio", icon: Truck },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/serraria", label: "Serraria", icon: Factory },
] as const;

export function AppShell() {
  const { session, loading, isAdmin, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [empresaSel, setEmpresaSel] = useState<string>(() => getEmpresaAtiva() ?? "");
  const empresas = useQuery({ queryKey: ["empresas"], queryFn: () => listarEmpresas(), enabled: isSuperAdmin });
  if (loading) return <div className="min-h-screen bg-forest" />;
  if (!session) return <LoginScreen />;
  const items = isAdmin || isSuperAdmin ? [...nav, { to: "/usuarios", label: "Usuários", icon: Users } as const] : nav;
  return (
    <div className="min-h-screen pb-20">
      <header className="no-print bg-forest text-primary-foreground px-4 py-3 flex items-center justify-between gap-2 sticky top-0 z-20">
        <span className="font-display text-xl font-bold uppercase tracking-wide shrink-0">Manejo Florestal</span>
        {isSuperAdmin && (
          <div className="flex items-center gap-1 min-w-0">
            <Building2 className="size-4 shrink-0 opacity-80" />
            <select
              aria-label="Empresa que você está visualizando"
              className="h-9 max-w-40 truncate rounded-md border border-primary-foreground/30 bg-forest px-2 text-sm"
              value={empresaSel}
              onChange={(e) => {
                setEmpresaSel(e.target.value);
                setEmpresaAtiva(e.target.value || null);
                qc.invalidateQueries();
              }}
            >
              <option value="">Todas as empresas</option>
              {(empresas.data ?? []).map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </div>
        )}
          <Button size="icon" variant="ghost" aria-label="Sair" onClick={() => supabase.auth.signOut()} className="opacity-80 shrink-0">
          <LogOut className="size-5" />
          </Button>
      </header>
      <SyncStatus />
      <main className="mx-auto max-w-3xl p-4">
        <Outlet />
      </main>
      <nav className="no-print fixed bottom-0 inset-x-0 bg-card border-t z-20">
        <div className="mx-auto max-w-3xl grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] text-muted-foreground data-[status=active]:text-primary data-[status=active]:font-semibold"
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

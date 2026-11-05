import { Link, Outlet } from "@tanstack/react-router";
import { Home, Layers, Truck, History, LogOut, TreePine } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { LoginScreen } from "./LoginScreen";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/", label: "Início", icon: Home },
  { to: "/base", label: "Base", icon: TreePine },
  { to: "/toras", label: "Toras", icon: Layers },
  { to: "/romaneio", label: "Romaneio", icon: Truck },
  { to: "/historico", label: "Histórico", icon: History },
] as const;

export function AppShell() {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-forest" />;
  if (!session) return <LoginScreen />;
  return (
    <div className="min-h-screen pb-20">
      <header className="no-print bg-forest text-primary-foreground px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <span className="font-display text-xl font-bold uppercase tracking-wide">Manejo Florestal</span>
        <button aria-label="Sair" onClick={() => supabase.auth.signOut()} className="opacity-80">
          <LogOut className="size-5" />
        </button>
      </header>
      <main className="mx-auto max-w-3xl p-4">
        <Outlet />
      </main>
      <nav className="no-print fixed bottom-0 inset-x-0 bg-card border-t z-20">
        <div className="mx-auto max-w-3xl grid grid-cols-5">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-col items-center gap-0.5 py-2.5 text-xs text-muted-foreground data-[status=active]:text-primary data-[status=active]:font-semibold"
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

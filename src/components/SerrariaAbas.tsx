import { Link } from "@tanstack/react-router";
import { SERRARIA_ABAS, type AbaSerraria } from "@/lib/nav";

const CLASSE =
  "rounded-md px-1 py-2 text-center text-xs leading-tight text-muted-foreground data-[ativo=true]:bg-background data-[ativo=true]:font-semibold data-[ativo=true]:text-foreground data-[ativo=true]:shadow-sm";

export function SerrariaAbas({ atual }: { atual: AbaSerraria }) {
  return (
    <nav aria-label="Serraria" className="no-print grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-5">
      {SERRARIA_ABAS.map((a) => {
        const ativo = a.aba === atual;
        return a.aba === "saldo" ? (
          <Link key={a.aba} to="/saldo" data-ativo={ativo} className={CLASSE}>
            {a.label}
          </Link>
        ) : (
          <Link key={a.aba} to="/serraria" search={{ aba: a.aba }} data-ativo={ativo} className={CLASSE}>
            {a.label}
          </Link>
        );
      })}
    </nav>
  );
}

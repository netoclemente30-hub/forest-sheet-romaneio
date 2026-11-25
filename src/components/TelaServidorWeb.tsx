import { Capacitor } from "@capacitor/core";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function TelaServidorWeb({ children, titulo }: { children: ReactNode; titulo: string }) {
  if (!Capacitor.isNativePlatform() && import.meta.env.MODE !== "android") return children;
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h1 className="font-semibold">{titulo}</h1>
      <p className="text-sm">Abra a versão web do Gestor Florestal para usar esta função.</p>
      <Link to="/" className="text-sm underline">Voltar ao início</Link>
    </section>
  );
}

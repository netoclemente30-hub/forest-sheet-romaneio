// Registro de atividade: quem lançou, quando e onde (GPS do aparelho).
// Browser-only: chamar de handlers de evento, nunca de render/SSR.

import { supabase } from "@/integrations/supabase/client";
import { empresaIdGravacao } from "./empresa";

export interface LogCapturado {
  operacao_id?: string;
  acao: string;
  detalhe: string;
  user_email: string | null;
  lat: number | null;
  lng: number | null;
  criado_em: string;
}

function posicaoGps(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 },
    );
  });
}

// Captura quem/quando/onde no momento do lançamento (funciona offline).
export async function capturarLog(acao: string, detalhe: string): Promise<LogCapturado> {
   const usuario = typeof navigator !== "undefined" && !navigator.onLine
     ? supabase.auth.getSession().then(({ data }) => data.session?.user ?? null)
     : supabase.auth.getUser().then(({ data }) => data.user);
   const [u, gps] = await Promise.all([usuario, posicaoGps()]);
  return {
    operacao_id: crypto.randomUUID(),
    acao,
    detalhe,
     user_email: u?.email ?? null,
    lat: gps?.lat ?? null,
    lng: gps?.lng ?? null,
    criado_em: new Date().toISOString(),
  };
}

// Grava o registro na nuvem (usado online e pela sincronização da fila).
export async function gravarRegistro(log: LogCapturado): Promise<void> {
  const { operacao_id: _operacao, ...dados } = log;
  const { error } = await supabase.from("registros").insert({ ...dados, ...empresaIdGravacao() });
  if (error) console.warn("Falha ao gravar registro:", error.message);
}

export function linkMaps(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

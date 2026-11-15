// Definições das seções de navegação (Módulo Florestal).
// Sem imports de browser/backend: pode ser lido por testes e pelo AppShell.

export type AbaSerraria = "patio" | "encaixadas" | "serradas" | "madeira" | "saldo";
export type AbaSerrariaUrl = Exclude<AbaSerraria, "saldo">;

export const MANEJO = [
  { to: "/base", label: "Base" },
  { to: "/toras", label: "Toras de manejo" },
  { to: "/explanadas", label: "Explanadas" },
  { to: "/romaneio", label: "Romaneio de toras" },
  { to: "/cortador", label: "Mapa" },
] as const;

export const SERRARIA_ABAS: { aba: AbaSerraria; label: string }[] = [
  { aba: "patio", label: "Estoque / Pátio" },
  { aba: "encaixadas", label: "Toras Encaixadas" },
  { aba: "serradas", label: "Toras serradas" },
  { aba: "madeira", label: "Madeira serrada" },
  { aba: "saldo", label: "Conferir saldo" },
];

export const ABAS_SERRARIA_URL: AbaSerrariaUrl[] = ["patio", "encaixadas", "serradas", "madeira"];

export function abaSerrariaDoBusca(valor: unknown): AbaSerrariaUrl | undefined {
  return ABAS_SERRARIA_URL.find((a) => a === valor);
}

const MANEJO_PATHS = ["/cortador", "/base", "/toras", "/romaneio", "/historico", "/etiquetas", "/importar", "/explanadas"];
const SERRARIA_PATHS = ["/serraria", "/saldo", "/entrada"];

// Superfícies públicas: abrem sem login (QR da tora e apresentação do app).
const PUBLICAS = ["/apresentacao"];

const contem = (paths: readonly string[], p: string) => paths.some((m) => p === m || p.startsWith(`${m}/`));

export const emManejo = (p: string) => contem(MANEJO_PATHS, p);
export const emSerraria = (p: string) => contem(SERRARIA_PATHS, p);

/**
 * Section shown for a path. The yard manager consults load history from the
 * Sawmill, so /historico keeps the Sawmill context for that role.
 */
export function secaoDaRota(p: string, papel?: string): "manejo" | "serraria" | null {
  if (papel === "gerente_patio" && contem(["/historico"], p)) return "serraria";
  if (emSerraria(p)) return "serraria";
  if (emManejo(p)) return "manejo";
  return null;
}

/**
 * Rota aberta a quem não está logado. O QR da tora (/t/<id>) e a apresentação
 * são as únicas; qualquer outro caminho exige sessão.
 */
export function ehRotaPublica(p: string): boolean {
  return p.startsWith("/t/") || contem(PUBLICAS, p);
}

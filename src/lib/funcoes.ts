/**
 * Cargos operacionais por empresa. Esta matriz controla apresentação e navegação.
 * A segurança real DEVE repetir estas permissões no Postgres (RLS/RPCs).
 * Sem função cadastrada, o acesso operacional é negado por padrão.
 */
export const FUNCOES = [
  { valor: "cortador", nome: "Cortador", descricao: "Mapa, localização e abatimento de árvores" },
  { valor: "tratorista", nome: "Tratorista", descricao: "Mapa e arrasto de árvores, mesmo antes do traçamento" },
  { valor: "romaneador", nome: "Romaneador", descricao: "Lançamento de toras e pátios/explanadas" },
  { valor: "motorista", nome: "Motorista", descricao: "Carregamento, romaneio de carga e TXT NF-e" },
  { valor: "gerente_patio", nome: "Gerente de pátio", descricao: "Operação completa da serraria" },
  { valor: "gerente_escritorio", nome: "Gerente de escritório", descricao: "Módulo fiscal completo; consultas, relatórios e registros sem alterar a operação" },
  { valor: "engenheiro", nome: "Engenheiro Florestal", descricao: "PMFS, POA, inventário 100%, mapas offline e exportação IF100" },
] as const;

export type FuncaoFuncionario = (typeof FUNCOES)[number]["valor"];
export type Papel = FuncaoFuncionario | "admin_empresa" | "superadmin" | "sem_funcao";
export type Permissao =
  | "mapa_ver" | "mapa_abater" | "mapa_arrastar" | "mapa_rastrear"
  | "toras_ver" | "toras_lancar" | "patios_criar"
  | "carga_criar" | "nfe_txt"
  | "serraria_ver" | "serraria_operar"
  | "relatorios" | "registros_ver" | "registros_reverter"
  | "usuarios_gerenciar" | "base_importar" | "informacoes_ver" | "engenheiro_acessar";

const ACESSOS: Record<Papel, readonly Permissao[]> = {
  superadmin: [
    "mapa_ver","mapa_abater","mapa_arrastar","mapa_rastrear","toras_ver",
    "toras_lancar","patios_criar","carga_criar","nfe_txt",
    "serraria_ver","serraria_operar","relatorios","registros_ver",
    "registros_reverter","usuarios_gerenciar","base_importar","informacoes_ver","engenheiro_acessar",
  ],
  admin_empresa: [
    "mapa_ver","mapa_abater","mapa_arrastar","mapa_rastrear","toras_ver",
    "toras_lancar","patios_criar","carga_criar","nfe_txt",
    "serraria_ver","serraria_operar","relatorios","registros_ver",
    "registros_reverter","usuarios_gerenciar","base_importar","informacoes_ver","engenheiro_acessar",
  ],
  cortador: ["mapa_ver","mapa_abater","mapa_rastrear"],
  tratorista: ["mapa_ver","mapa_arrastar","mapa_rastrear"],
  romaneador: ["toras_ver","toras_lancar","patios_criar","mapa_ver"],
  motorista: ["carga_criar","nfe_txt","toras_ver"],
  gerente_patio: ["serraria_ver","serraria_operar","toras_ver","relatorios"],
  gerente_escritorio: [
    "mapa_ver","toras_ver","serraria_ver","relatorios","registros_ver","informacoes_ver",
  ],
  engenheiro: ["engenheiro_acessar"],
  sem_funcao: [],
};

export const funcaoValida = (valor: unknown): valor is FuncaoFuncionario =>
  typeof valor === "string" && FUNCOES.some(({ valor: v }) => v === valor);

export function pode(papel: Papel, permissao: Permissao): boolean {
  return ACESSOS[papel].includes(permissao);
}

export function papelDoUsuario(
  isSuperAdmin: boolean,
  isAdmin: boolean,
  funcao: unknown,
): Papel {
  if (isSuperAdmin) return "superadmin";
  if (isAdmin) return "admin_empresa";
  return funcaoValida(funcao) ? funcao : "sem_funcao";
}

export function rotaPermitida(papel: Papel, pathname: string): boolean {
  if (papel === "superadmin" || papel === "admin_empresa") return true;
  if (pathname === "/ajuda") return true;
  if (pathname === "/") return papel === "gerente_escritorio";
  if (pathname === "/cortador" || pathname.startsWith("/cortador/")) return pode(papel, "mapa_ver");
  if (pathname === "/toras" || pathname.startsWith("/toras/")) return pode(papel, "toras_lancar") || papel === "gerente_escritorio";
  if (pathname === "/romaneio" || pathname.startsWith("/romaneio/") ||
      pathname === "/historico" || pathname.startsWith("/historico/")) return pode(papel, "carga_criar") || papel === "gerente_patio" || papel === "gerente_escritorio";
  if (pathname === "/serraria" || pathname.startsWith("/serraria/") ||
      pathname === "/saldo") return pode(papel, "serraria_ver");
  if (pathname === "/entrada") return pode(papel, "serraria_operar") || papel === "gerente_escritorio";
  if (pathname === "/explanadas") return pode(papel, "patios_criar") || papel === "gerente_escritorio";
  if (pathname === "/etiquetas") return pode(papel, "toras_lancar") || pode(papel, "serraria_operar") || papel === "gerente_escritorio";
  if (pathname === "/relatorios") return pode(papel, "relatorios");
  if (pathname === "/registros") return pode(papel, "registros_ver");
  if (pathname === "/base" || pathname.startsWith("/base/")) return papel === "gerente_escritorio";
  if (pathname === "/fiscal") return papel === "gerente_escritorio";
  if (pathname === "/engenheiro") return pode(papel, "engenheiro_acessar");
  if (pathname === "/importar" || pathname === "/usuarios") return false;
  return false;
}

export function rotaInicial(papel: Papel): "/" | "/cortador" | "/toras" | "/romaneio" | "/serraria" | "/engenheiro" {
  if (papel === "cortador" || papel === "tratorista") return "/cortador";
  if (papel === "romaneador") return "/toras";
  if (papel === "motorista") return "/romaneio";
  if (papel === "gerente_patio") return "/serraria";
  if (papel === "engenheiro") return "/engenheiro";
  return "/";
}

export function nomePapel(papel: Papel): string {
  if (papel === "superadmin") return "Administrador geral";
  if (papel === "admin_empresa") return "Administrador da empresa";
  if (papel === "sem_funcao") return "Sem função atribuída";
  return FUNCOES.find((f) => f.valor === papel)?.nome ?? papel;
}

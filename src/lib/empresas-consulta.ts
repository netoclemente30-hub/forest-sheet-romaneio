// Consultas que carregam a lista de empresas: a tabela da tela Usuários usa
// ["empresas"] e o seletor do topo usa ["empresas-menu", <usuário>].
// Qualquer alteração de empresa precisa alcançar as duas, senão o seletor do
// topo continua mostrando a lista antiga até recarregar o app.
import type { QueryClient, QueryKey } from "@tanstack/react-query";

const PREFIXOS = ["empresas", "empresas-menu"] as const;

/** Chave da lista de empresas usada pelo seletor do topo (uma por usuário). */
export function chaveEmpresasMenu(usuario: string | undefined) {
  return ["empresas-menu", usuario] as const;
}

/** true quando a consulta guarda a lista de empresas (tela ou seletor do topo). */
export function ehConsultaDeEmpresas(key: QueryKey): boolean {
  const inicio = key[0];
  return typeof inicio === "string" && (PREFIXOS as readonly string[]).includes(inicio);
}

/** Atualiza a tabela de empresas e o seletor do topo de uma só vez. */
export function invalidarEmpresas(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({ predicate: (q) => ehConsultaDeEmpresas(q.queryKey) });
}

/**
 * true quando a consulta pode sobreviver à troca de empresa.
 * Tudo que depende da empresa escolhida é descartado; apenas a lista de
 * empresas (inclusive a do seletor do topo) é mantida.
 */
export function manterNaTrocaDeEmpresa(key: QueryKey): boolean {
  return ehConsultaDeEmpresas(key);
}

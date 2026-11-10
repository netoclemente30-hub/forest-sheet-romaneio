export type RegistroFiltro = { numero: number; user_email: string | null; acao: string; detalhe: string | null; mudancas: unknown; revertido_em: string | null; reversao_de: string | null; aparelho_nome?: string | null; aparelho_modelo?: string | null };
export function filtrarRegistros<T extends RegistroFiltro>(registros: T[], usuario: string, busca: string): T[] {
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  return registros.filter((r) => (!usuario || (r.user_email ?? "") === usuario) && (!termo || [r.numero, r.user_email, r.acao, r.detalhe, r.aparelho_nome, r.aparelho_modelo].join(" ").toLocaleLowerCase("pt-BR").includes(termo)));
}
export function podeReverterRegistro(r: Pick<RegistroFiltro, "mudancas" | "revertido_em" | "reversao_de">): boolean {
  return !r.revertido_em && !r.reversao_de && Array.isArray(r.mudancas) && r.mudancas.length > 0;
}
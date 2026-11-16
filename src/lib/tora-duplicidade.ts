export type IdentidadeTora = {
  arvore: number;
  secao: string | null;
  autex: string | null;
  empresa_id?: string | null;
  plaqueta: number;
};

const secaoNormalizada = (s: string | null) => (s ?? "").trim().toUpperCase();
export const secaoParaLancamento = (secao: string | null): string | null => secaoNormalizada(secao) || null;
const autexNormalizada = (s: string | null) => (s ?? "").trim().toUpperCase().replace(/^AUTEX[\s:-]*/, "");

export function toraDuplicada<T extends IdentidadeTora>(toras: T[], alvo: Omit<IdentidadeTora, "plaqueta">, ignorarPlaqueta?: number): T | undefined {
  return toras.find((t) =>
    t.empresa_id === alvo.empresa_id &&
    t.plaqueta !== ignorarPlaqueta &&
    t.arvore === alvo.arvore &&
    secaoNormalizada(t.secao) === secaoNormalizada(alvo.secao) &&
    autexNormalizada(t.autex) === autexNormalizada(alvo.autex),
  );
}

export function avisoDuplicidade(t: IdentidadeTora): string {
  const secao = secaoNormalizada(t.secao);
  return secao ? `Árvore ${t.arvore} já tem a secção ${secao} (plaqueta ${t.plaqueta})` : `Árvore ${t.arvore} sem seção já foi lançada nesta autorização (plaqueta ${t.plaqueta})`;
}
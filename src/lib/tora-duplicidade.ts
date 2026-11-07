export type IdentidadeTora = {
  arvore: number;
  secao: string | null;
  autex: string | null;
  empresa_id?: string | null;
  plaqueta: number;
};

const secaoNormalizada = (s: string | null) => (s ?? "").trim().toUpperCase();
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
  return `Árvore ${t.arvore} já tem a secção ${secaoNormalizada(t.secao)} (plaqueta ${t.plaqueta})`;
}
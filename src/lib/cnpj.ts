/** Mantém só os dígitos do CNPJ. */
export function limparCnpj(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Valida os dígitos verificadores do CNPJ (14 dígitos). */
export function cnpjValido(v: string): boolean {
  const d = limparCnpj(v);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + Number(d[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export function formatarCnpj(v: string): string {
  const d = limparCnpj(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export const LIMITE_DEMONSTRACAO = 50;
export type StatusEmpresa = "pendente" | "demonstracao" | "ativa" | "inativa";

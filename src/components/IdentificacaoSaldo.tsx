/** Linha de identificação do saldo como um único texto: um trecho condicional
 * separado ("Plaqueta N · ") vira nó de texto que o tradutor do navegador
 * substitui, e o React quebra ao inseri-lo/removê-lo quando o filtro muda. */
export function textoIdentificacaoSaldo(plaqueta: number | null | undefined, l: { arvore?: unknown; secao?: string | null; autex?: string | null }) {
  return `${plaqueta != null ? `Plaqueta ${plaqueta} · ` : ""}Árv. ${l.arvore ?? "–"} · Sec. ${l.secao || "–"} · AUTEX ${l.autex || "—"}`;
}

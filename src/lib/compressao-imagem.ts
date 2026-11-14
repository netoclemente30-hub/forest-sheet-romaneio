/** Compressão de fotos no navegador antes de guardar/enviar (economiza memória e IndexedDB). */
export const LADO_MAXIMO = 1280;
export const QUALIDADE = 0.8;

/** Calcula dimensões que cabem em `max` px mantendo a proporção (nunca amplia). */
export function dimensoesReduzidas(largura: number, altura: number, max = LADO_MAXIMO): { largura: number; altura: number } {
  if (!(largura > 0) || !(altura > 0)) return { largura: 0, altura: 0 };
  const maior = Math.max(largura, altura);
  if (maior <= max) return { largura: Math.round(largura), altura: Math.round(altura) };
  const f = max / maior;
  return { largura: Math.max(1, Math.round(largura * f)), altura: Math.max(1, Math.round(altura * f)) };
}

function suportaWebp(): boolean {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch { return false; }
}

/** Reduz para no máximo 1280 px e recodifica em WebP (ou JPEG). Retorna o original se não ficar menor. */
export async function comprimirImagem(arquivo: Blob, opcoes: { max?: number; qualidade?: number } = {}): Promise<Blob> {
  if (typeof document === "undefined" || !arquivo.type.startsWith("image/")) return arquivo;
  const max = opcoes.max ?? LADO_MAXIMO;
  const qualidade = opcoes.qualidade ?? QUALIDADE;
  const bitmap = await createImageBitmap(arquivo);
  try {
    const { largura, altura } = dimensoesReduzidas(bitmap.width, bitmap.height, max);
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return arquivo;
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    const tipo = suportaWebp() ? "image/webp" : "image/jpeg";
    const saida = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, qualidade));
    if (!saida) return arquivo;
    const reduziu = largura < bitmap.width || altura < bitmap.height;
    return saida.size < arquivo.size || reduziu ? saida : arquivo;
  } finally {
    bitmap.close?.();
  }
}

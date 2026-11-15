import { linkWhatsapp } from "./nfe-txt";

export type ArquivoGerado = { blob: Blob; nome: string };

export function baixarArquivo({ blob, nome }: ArquivoGerado) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// Call from a user click, after generation, to preserve Safari user activation.
export async function salvarArquivo(arquivo: ArquivoGerado) {
  const file = new File([arquivo.blob], arquivo.nome, { type: arquivo.blob.type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: arquivo.nome });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  baixarArquivo(arquivo);
}

// Compartilha o arquivo no WhatsApp pela lista de apps do aparelho.
// Sem suporte a anexos, abre o WhatsApp com o resumo em texto.
// Chamar direto no clique, para não perder a ativação do navegador.
export async function compartilharNoWhatsapp(arquivo: ArquivoGerado, texto: string): Promise<"arquivo" | "texto" | null> {
  const file = new File([arquivo.blob], arquivo.nome, { type: arquivo.blob.type });
  const pode = (dados: ShareData) => typeof navigator !== "undefined" && !!navigator.canShare?.(dados);
  if (pode({ files: [file], text: texto })) {
    try { await navigator.share({ files: [file], text: texto, title: arquivo.nome }); return "arquivo"; }
    catch (error) { if (error instanceof DOMException && error.name === "AbortError") return null; }
  } else if (pode({ files: [file] })) {
    try { await navigator.share({ files: [file], title: arquivo.nome }); return "arquivo"; }
    catch (error) { if (error instanceof DOMException && error.name === "AbortError") return null; }
  }
  window.open(linkWhatsapp(texto), "_blank");
  return "texto";
}

/**
 * Compartilha O ARQUIVO REAL pela folha nativa do Android/iOS.
 * Se o navegador impedir o anexo, faz download do próprio arquivo;
 * NUNCA abre WhatsApp com texto substituindo o PDF/TXT.
 *
 * Chame diretamente a partir do clique do usuário.
 */
export async function compartilharArquivoExato(
  arquivo: ArquivoGerado,
): Promise<"compartilhado" | "baixado" | "cancelado"> {
  const file = new File([arquivo.blob], arquivo.nome, { type: arquivo.blob.type });
  if (typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: arquivo.nome });
      return "compartilhado";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelado";
    }
  }
  baixarArquivo(arquivo);
  return "baixado";
}

import { Capacitor } from "@capacitor/core";
import { linkWhatsapp } from "./nfe-txt";

export type ArquivoGerado = { blob: Blob; nome: string };

function baixarNaWeb({ blob, nome }: ArquivoGerado) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function compartilharNativo(arquivo: ArquivoGerado, text?: string): Promise<boolean> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"), import("@capacitor/share"),
  ]);
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(arquivo.blob);
  });
  // Caracteres de controle são inválidos no nome entregue ao sistema de arquivos.
  // eslint-disable-next-line no-control-regex
  const nome = arquivo.nome.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/^\.+/, "") || "arquivo";
  const { uri } = await Filesystem.writeFile({
    path: "exportacoes/" + crypto.randomUUID() + "/" + nome,
    data, directory: Directory.Cache, recursive: true,
  });
  try {
    await Share.share({ files: [uri], title: arquivo.nome, ...(text ? { text } : {}) });
    return true;
  } catch (error) {
    if (/cancel/i.test(error instanceof Error ? error.message : String(error))) return false;
    throw error;
  }
}

export async function baixarArquivo(arquivo: ArquivoGerado) {
  if (Capacitor.isNativePlatform()) await compartilharNativo(arquivo);
  else baixarNaWeb(arquivo);
}

// Call from a user click, after generation, to preserve Safari user activation.
export async function salvarArquivo(arquivo: ArquivoGerado) {
  if (Capacitor.isNativePlatform()) return baixarArquivo(arquivo);
  const file = new File([arquivo.blob], arquivo.nome, { type: arquivo.blob.type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: arquivo.nome });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  baixarNaWeb(arquivo);
}

// Compartilha o arquivo no WhatsApp pela lista de apps do aparelho.
// Sem suporte a anexos, abre o WhatsApp com o resumo em texto.
// Chamar direto no clique, para não perder a ativação do navegador.
export async function compartilharNoWhatsapp(arquivo: ArquivoGerado, texto: string): Promise<"arquivo" | "texto" | null> {
  if (Capacitor.isNativePlatform()) return await compartilharNativo(arquivo, texto) ? "arquivo" : null;
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
  if (Capacitor.isNativePlatform()) return await compartilharNativo(arquivo) ? "compartilhado" : "cancelado";
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
  baixarNaWeb(arquivo);
  return "baixado";
}

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
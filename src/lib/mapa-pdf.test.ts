import { describe, expect, it } from "vitest";
import { caminhoMapaPdf, MAPA_PDF_MAX_BYTES, validarMapaPdf } from "./mapa-pdf";

function arquivo(nome = "mapa.pdf", _size = 8, type = "application/pdf", conteudo = "%PDF-1.7") {
  return new File([conteudo], nome, { type });
}

describe("PDF do mapa exploratório", () => {
  it("aceita PDF com extensão e assinatura válidas", async () => {
    await expect(validarMapaPdf(arquivo())).resolves.toBeUndefined();
  });

  it("recusa arquivo que não seja PDF", async () => {
    await expect(validarMapaPdf(arquivo("mapa.txt", 8, "text/plain"))).rejects.toThrow("formato PDF");
  });

  it("recusa PDF vazio", async () => {
    await expect(validarMapaPdf(new File([], "mapa.pdf", { type: "application/pdf" }))).rejects.toThrow("está vazio");
  });

  it("recusa arquivo acima de 25 MB sem carregar seu conteúdo", async () => {
    const file = { name: "mapa.pdf", type: "application/pdf", size: MAPA_PDF_MAX_BYTES + 1, slice: () => { throw new Error("não deveria ler"); } };
    await expect(validarMapaPdf(file as never)).rejects.toThrow("no máximo 25 MB");
  });

  it("recusa extensão PDF sem assinatura PDF", async () => {
    await expect(validarMapaPdf(arquivo("mapa.pdf", 8, "application/pdf", "não é pdf"))).rejects.toThrow("não contém um PDF válido");
  });

  it("separa o arquivo pela empresa no caminho privado", () => {
    const empresa = crypto.randomUUID();
    const id = crypto.randomUUID();
    expect(caminhoMapaPdf(empresa, id)).toBe(`${empresa}/${id}.pdf`);
  });
});

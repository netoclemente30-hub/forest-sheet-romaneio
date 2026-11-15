import { afterEach, describe, expect, it, vi } from "vitest";
import { compartilharArquivoExato, compartilharNoWhatsapp } from "./arquivo";

const arquivo = { blob: new Blob(["%PDF-1.4 teste"], { type: "application/pdf" }), nome: "relatorio_toras.pdf" };
const texto = "*RELATÓRIO DE TORAS — PÁTIO*\n2 toras · 3,0000 m³";

function definir(prop: "canShare" | "share", valor: unknown) {
  Object.defineProperty(navigator, prop, { value: valor, configurable: true, writable: true });
}

afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>)["canShare"];
  delete (navigator as unknown as Record<string, unknown>)["share"];
  vi.restoreAllMocks();
});

describe("compartilharNoWhatsapp", () => {
  it("envia o arquivo junto com o resumo quando o aparelho aceita anexos", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    definir("canShare", (d: ShareData) => !!d.files && !!d.text);
    definir("share", share);
    const aberto = vi.spyOn(window, "open").mockReturnValue(null);
    const modo = await compartilharNoWhatsapp(arquivo, texto);
    expect(modo).toBe("arquivo");
    expect(share).toHaveBeenCalledTimes(1);
    const enviado = share.mock.calls[0]?.[0] as ShareData;
    expect(enviado.files?.[0]?.name).toBe("relatorio_toras.pdf");
    expect(enviado.text).toBe(texto);
    expect(aberto).not.toHaveBeenCalled();
  });

  it("abre o WhatsApp com o resumo em texto quando não há suporte a anexos", async () => {
    definir("canShare", () => false);
    const aberto = vi.spyOn(window, "open").mockReturnValue(null);
    const modo = await compartilharNoWhatsapp(arquivo, texto);
    expect(modo).toBe("texto");
    const url = aberto.mock.calls[0]?.[0] as string;
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("2 toras · 3,0000 m³");
  });

  it("não abre nada quando o usuário cancela o compartilhamento", async () => {
    definir("canShare", (d: ShareData) => !!d.files);
    definir("share", vi.fn().mockRejectedValue(new DOMException("cancelado", "AbortError")));
    const aberto = vi.spyOn(window, "open").mockReturnValue(null);
    expect(await compartilharNoWhatsapp(arquivo, texto)).toBeNull();
    expect(aberto).not.toHaveBeenCalled();
  });
});

describe("compartilharArquivoExato: somente arquivo, nunca WhatsApp em texto", () => {
  it("compartilha PDF como arquivo quando o celular permite", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    definir("share", share);
    definir("canShare", ({ files }: ShareData) => !!files?.length);
    const wa = vi.spyOn(window, "open").mockReturnValue(null);
    const resultado = await compartilharArquivoExato(arquivo);
    expect(resultado).toBe("compartilhado");
    expect((share.mock.calls[0]?.[0] as ShareData).files?.[0]?.name).toBe("relatorio_toras.pdf");
    expect((share.mock.calls[0]?.[0] as ShareData).files?.[0]?.type).toBe("application/pdf");
    expect((share.mock.calls[0]?.[0] as ShareData).text).toBeUndefined();
    expect(wa).not.toHaveBeenCalled();
  });

  it("compartilha TXT como arquivo .txt sem colar conteúdo", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    definir("share", share);
    definir("canShare", ({ files }: ShareData) => files?.[0]?.name.endsWith(".txt") ?? false);
    const txt = new Blob(["NOTAFISCAL|1|\\nA|4.00|NFe|\\n"], { type: "text/plain;charset=utf-8" });
    const resultado = await compartilharArquivoExato({ blob: txt, nome: "nfe-romaneio.txt" });
    expect(resultado).toBe("compartilhado");
    const dados = share.mock.calls[0]?.[0] as ShareData;
    expect(dados.files?.[0]?.name).toBe("nfe-romaneio.txt");
    expect(dados.text).toBeUndefined();
  });

  it("se o aparelho não permite anexo, baixa o PDF sem abrir WhatsApp", async () => {
    definir("canShare", () => false);
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:romaneio-teste");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const result = await compartilharArquivoExato(arquivo);
    expect(result).toBe("baixado");
    expect(create).toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it("cancelamento nativo não baixa nem abre WhatsApp", async () => {
    definir("canShare", () => true);
    definir("share", vi.fn().mockRejectedValue(new DOMException("Cancelado", "AbortError")));
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const download = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    expect(await compartilharArquivoExato(arquivo)).toBe("cancelado");
    expect(download).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});

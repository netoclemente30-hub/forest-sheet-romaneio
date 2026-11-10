import { afterEach, describe, expect, it, vi } from "vitest";
import { compartilharNoWhatsapp } from "./arquivo";

const arquivo = { blob: new Blob(["%PDF-1.4 teste"], { type: "application/pdf" }), nome: "relatorio_toras.pdf" };
const texto = "*RELATÓRIO DE TORAS — PÁTIO*\n2 toras · 3,0000 m³";

function definir(prop: "canShare" | "share", valor: unknown) {
  Object.defineProperty(navigator, prop, { value: valor, configurable: true, writable: true });
}

afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>).canShare;
  delete (navigator as unknown as Record<string, unknown>).share;
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

import { describe, expect, it, vi } from "vitest";

const consultar = vi.hoisted(() => vi.fn());
vi.mock("@/lib/consulta-tora-publica", () => ({
  consultarFichaPublicaTora: consultar,
}));

import { Route } from "@/routes/t/$id";

const params = { id: "a5ef9bc0-9739-4d88-81fc-1ff25cf7df6a" };

describe("QR público: carregamento feito durante SSR", () => {
  it("devolve ficha completa no carregamento inicial sem login/hidratação", async () => {
    const ficha = { plaqueta: 1, empresa_nome: "MADENORTE", serrada_em: null };
    consultar.mockResolvedValueOnce(ficha);
    const dados = await Route.options.loader!({ params } as never);
    expect(dados).toEqual({ tora: ficha, erro: null });
    expect(consultar).toHaveBeenCalledWith(params.id);
  });
  it("devolve erro legível no HTML SSR quando falha a rede", async () => {
    consultar.mockRejectedValueOnce(new Error("Falha de conexão com o servidor."));
    const dados = await Route.options.loader!({ params } as never);
    expect(dados).toEqual({ tora: null, erro: "Falha de conexão com o servidor." });
  });
  it("devolve não encontrada sem ficar carregando", async () => {
    consultar.mockResolvedValueOnce(null);
    const dados = await Route.options.loader!({ params } as never);
    expect(dados).toEqual({ tora: null, erro: null });
  });
});

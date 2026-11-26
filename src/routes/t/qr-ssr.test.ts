import { describe, expect, it, vi } from "vitest";

const consultar = vi.hoisted(() => vi.fn());
const copiaOffline = vi.hoisted(() => vi.fn());
vi.mock("@/lib/consulta-tora-publica", () => ({
  consultarFichaPublicaTora: consultar,
  lerFichaPublicaOffline: copiaOffline,
  guardarFichaPublica: vi.fn(),
}));

import { Route } from "@/routes/t/$id";

const params = { id: "a5ef9bc0-9739-4d88-81fc-1ff25cf7df6a" };
const carregar = Route.options.loader as (ctx: { params: typeof params }) => Promise<{ tora: unknown; erro: string | null }>;

describe("QR público: carregamento feito durante SSR", () => {
  it("devolve ficha completa no carregamento inicial sem login/hidratação", async () => {
    const ficha = { plaqueta: 1, empresa_nome: "MADENORTE", serrada_em: null };
    consultar.mockResolvedValueOnce(ficha);
    const dados = await carregar({ params });
    expect(dados).toEqual({ tora: ficha, erro: null });
    expect(consultar).toHaveBeenCalledWith(params.id);
  });
  it("devolve erro legível no HTML SSR quando falha a rede", async () => {
    consultar.mockRejectedValueOnce(new Error("Falha de conexão com o servidor."));
    const dados = await carregar({ params });
    expect(dados).toEqual({ tora: null, erro: "Falha de conexão com o servidor." });
  });
  it("devolve não encontrada sem ficar carregando", async () => {
    consultar.mockResolvedValueOnce(null);
    const dados = await carregar({ params });
    expect(dados).toEqual({ tora: null, erro: null });
  });
  it("identifica a cópia offline e mantém a data registrada do arraste", async () => {
    const tora = { plaqueta: 1, arrastada_em: "2026-11-25T02:00:00Z" };
    const consultadaEm = Date.UTC(2026, 10, 25, 13);
    consultar.mockRejectedValueOnce(new Error("Sem conexão"));
    copiaOffline.mockReturnValueOnce({ tora, consultadaEm });
    await expect(carregar({ params })).resolves.toEqual({ tora, consultadaEm, erro: null });
  });
});

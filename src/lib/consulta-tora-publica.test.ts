import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consultarFichaPublicaTora, ErroConsultaTora, guardarFichaPublica, lerFichaPublicaOffline } from "./consulta-tora-publica";

const id = "a5ef9bc0-9739-4d88-81fc-1ff25cf7df6a";

beforeEach(() => {
  const armazenamento = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (chave: string) => armazenamento.get(chave) ?? null,
    setItem: (chave: string, valor: string) => armazenamento.set(chave, valor),
    removeItem: (chave: string) => armazenamento.delete(chave),
  });
  vi.stubEnv("VITE_SUPABASE_URL", "https://teste.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste");
  vi.stubGlobal("navigator", { onLine: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("consulta pública da tora sem login", () => {
  it("consulta a RPC com apikey publicável e SEM token ou cookies de usuário", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ plaqueta: 1, serrada_em: "2026-11-16T12:39:00Z", arrastada_em: "2026-11-12T10:00:00Z" }],
    });
    const tora = await consultarFichaPublicaTora(id, { fetcher });
    expect(tora?.plaqueta).toBe(1);
    expect(tora?.serrada_em).toBe("2026-11-16T12:39:00Z");
    expect(tora?.arrastada_em).toBe("2026-11-12T10:00:00Z");
    const args = fetcher.mock.calls[0];
    expect(args).toBeDefined();
    const [url, opts] = args!;
    expect(url).toBe("https://teste.supabase.co/rest/v1/rpc/tora_publica");
    expect(opts.method).toBe("POST");
    expect(opts.credentials).toBe("omit");
    expect(opts.cache).toBe("no-store");
    expect(opts.headers.apikey).toBe("sb_publishable_teste");
    expect(opts.headers.Authorization).toBeUndefined();
    expect(opts.body).toBe(JSON.stringify({ _id: id }));
  });

  it("reabre apenas o QR consultado offline e invalida a cópia após a permissão ser negada", async () => {
    const arrastada_em = "2026-11-12T10:00:00Z";
    const tora = await consultarFichaPublicaTora(id, {
      fetcher: vi.fn().mockResolvedValue({ ok: true, json: async () => [{ plaqueta: 1, arrastada_em }] }),
    });
    guardarFichaPublica(id, tora!);
    expect(lerFichaPublicaOffline(id)).toBeNull();
    vi.stubGlobal("navigator", { onLine: false });
    expect(lerFichaPublicaOffline(id)?.tora.arrastada_em).toBe(arrastada_em);
    expect(lerFichaPublicaOffline("b5ef9bc0-9739-4d88-81fc-1ff25cf7df6a")).toBeNull();
    vi.stubGlobal("navigator", { onLine: true });
    await expect(consultarFichaPublicaTora(id, {
      fetcher: vi.fn().mockResolvedValue({ ok: false, status: 403 }),
    })).rejects.toBeInstanceOf(ErroConsultaTora);
    vi.stubGlobal("navigator", { onLine: false });
    expect(lerFichaPublicaOffline(id)).toBeNull();
  });

  it("QR inválido não faz nenhuma consulta", async () => {
    const fetcher = vi.fn();
    expect(await consultarFichaPublicaTora("invalido", { fetcher })).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("retorna tora não encontrada sem prender no carregando", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    expect(await consultarFichaPublicaTora(id, { fetcher })).toBeNull();
  });

  it("falha rápido quando não há internet, sem esperar pela sessão", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const fetcher = vi.fn();
    await expect(consultarFichaPublicaTora(id, { fetcher }))
      .rejects.toThrow("Sem conexão com a internet");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("retorna erro claro se não houver permissão para consulta anônima", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(consultarFichaPublicaTora(id, { fetcher }))
      .rejects.toThrow("Consulta pública indisponível");
  });

  it("aborta a consulta que trava e exibe instrução de tentar novamente", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementation((_url: string, opts: RequestInit) =>
      new Promise((_resolve, reject) => {
        opts.signal?.addEventListener("abort", () => reject(new DOMException("Abortado", "AbortError")));
      }));
    const promise = consultarFichaPublicaTora(id, { fetcher, timeoutMs: 50 });
    const check = expect(promise).rejects.toThrow("A consulta demorou demais");
    await vi.advanceTimersByTimeAsync(51);
    await check;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("erros de rede resultam em mensagem controlada e permitem tentar de novo", async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce({ ok: true, json: async () => [{ plaqueta: 2 }] });
    await expect(consultarFichaPublicaTora(id, { fetcher }))
      .rejects.toBeInstanceOf(ErroConsultaTora);
    expect((await consultarFichaPublicaTora(id, { fetcher }))?.plaqueta).toBe(2);
  });
});

import { afterEach, expect, it, vi } from "vitest";
import { consultarFichaSerrada, lerCopiaSerrada } from "./rastreabilidade-serrada";

const id = "454af865-7c79-4437-ad32-2f05589b2493";
const ficha = { tipo: "carga", numero: "C-1", data: "2026-11-26", empresa: null, pacotes: [] };

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it("consulta sem credenciais e guarda somente o token consultado por 24 horas", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-26T10:00:00Z"));
  vi.stubEnv("VITE_SUPABASE_URL", "https://banco.example");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "publicavel");
  const fetcher = vi.fn().mockResolvedValue(Response.json(ficha));
  vi.stubGlobal("fetch", fetcher);
  await expect(consultarFichaSerrada(id, new AbortController().signal)).resolves.toEqual(ficha);
  expect(fetcher).toHaveBeenCalledWith("https://banco.example/rest/v1/rpc/rastreabilidade_serrada_publica", expect.objectContaining({
    credentials: "omit", cache: "no-store", body: JSON.stringify({ _id: id }),
  }));
  expect(lerCopiaSerrada(id)?.ficha).toEqual(ficha);
  expect(lerCopiaSerrada("154af865-7c79-4437-ad32-2f05589b2493")).toBeNull();
  vi.setSystemTime(new Date("2026-11-27T10:00:00Z"));
  expect(lerCopiaSerrada(id)).toBeNull();
});

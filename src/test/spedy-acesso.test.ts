import { expect, it, vi } from "vitest";
import { verificarSpedy } from "@/lib/spedy.functions";
const sandbox = vi.hoisted(() => vi.fn());
vi.mock("@/lib/spedy.server", () => ({ verificarSandbox: sandbox }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
const verificar = verificarSpedy as unknown as (req: {
  context: unknown;
  data: { empresa: string };
}) => Promise<unknown>;
it.each([
  [false, "a", "a"],
  [true, "a", "b"],
])(
  "nega operador ou empresa fora do vínculo antes de acessar o segredo",
  async (admin, vinculo, alvo) => {
    const rpc = (nome: string, args?: { _role: string }) => ({
      throwOnError: async () => ({
        data: nome === "admin_minha_empresa" ? vinculo : args?._role === "admin" && admin,
      }),
    });
    await expect(
      verificar({
        context: { userId: "user", supabase: { rpc } },
        data: { empresa: String(alvo) },
      }),
    ).rejects.toThrow();
    expect(sandbox).not.toHaveBeenCalled();
  },
);

import { expect, it, vi } from "vitest";
import { verificarSpedy, consultarEventosNfe, enviarEventoNfe } from "@/lib/spedy.functions";
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
it.each([consultarEventosNfe,enviarEventoNfe])("nega eventos antes de acessar segredos quando pode_fiscal é falso",async operacao=>{
  const rpc=vi.fn(async()=>({data:false,error:null}));
  const handler=operacao as unknown as (r:unknown)=>Promise<unknown>;
  await expect(handler({context:{userId:"u",supabase:{rpc}},data:{empresa:"outra",rascunhoId:"r"}})).rejects.toThrow();
  expect(rpc).toHaveBeenCalledWith("pode_fiscal",{_empresa:"outra"});
  expect(sandbox).not.toHaveBeenCalled();
});
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

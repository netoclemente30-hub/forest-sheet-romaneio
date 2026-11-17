import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const verificarSpedy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ empresa: z.string().uuid() }))
  .handler(async ({ data, context: { supabase, userId } }) => {
    const { data: geral } = await supabase
      .rpc("has_role", { _user_id: userId, _role: "superadmin" })
      .throwOnError();
    if (!geral) {
      const { data: admin } = await supabase
        .rpc("has_role", { _user_id: userId, _role: "admin" })
        .throwOnError();
      if (!admin) throw new Error("Acesso fiscal restrito.");
      const { data: empresa } = await supabase.rpc("admin_minha_empresa").throwOnError();
      if (empresa !== data.empresa)
        throw new Error("Acesso fiscal restrito ao administrador da empresa.");
    }
    const { verificarSandbox } = await import("./spedy.server");
    return verificarSandbox(data.empresa);
  });

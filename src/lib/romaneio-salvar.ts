import { supabase } from "@/integrations/supabase/client";
import { empresaIdGravacao } from "./empresa";
import type { LogCapturado } from "./registro";
import type { Json } from "@/integrations/supabase/types";

export type CabecalhoRomaneio = {
  placa: string; julieta: string; motorista: string; cpf: string; data: string;
};

/** A carga e a baixa das toras são realizadas pela mesma transação no banco. */
export async function salvarRomaneioNoBanco(
  cab: CabecalhoRomaneio, plaquetas: number[], log: LogCapturado,
  empresaSalva?: string | null, operacaoSalva?: string,
): Promise<string> {
  const empresaConfigurada = empresaSalva ?? empresaIdGravacao().empresa_id;
  let empresa = empresaConfigurada;
  if (!empresa) {
    const { data, error } = await supabase.rpc("minha_empresa");
    if (error) throw new Error(error.message);
    empresa = data ?? undefined;
  }
  if (!empresa) throw new Error("Escolha uma empresa antes de criar a carga");
  const operacao = log.operacao_id ?? operacaoSalva;
  if (!operacao) throw new Error("Identificador de operação ausente");
  const { data: id, error } = await supabase.rpc("salvar_romaneio_toras", {
    _empresa: empresa, _cab: cab as unknown as Json,
    _plaquetas: plaquetas, _operacao: operacao, _log: log as unknown as Json,
  });
  if (error) throw new Error(error.message);
  if (!id) throw new Error("A carga não retornou identificador");
  // Cadastros auxiliares não podem provocar nova baixa de toras em uma repetição da fila.
  const veiculo = async (placa: string, tipo: string) => {
    if (!placa.trim()) return;
    const { error } = await supabase.from("veiculos").upsert({
      placa: placa.trim().toUpperCase(), tipo, empresa_id: empresa,
    }, { onConflict: "empresa_id,placa,tipo", ignoreDuplicates: true });
    if (error) console.warn("Cadastro auxiliar de veículo:", error.message);
  };
  await Promise.all([
    veiculo(cab.placa, "caminhao"), veiculo(cab.julieta, "reboque"),
    cab.motorista.trim() ? supabase.from("motoristas").upsert({
      nome: cab.motorista.trim(), cpf: cab.cpf.trim() || null, empresa_id: empresa,
    }, { onConflict: "empresa_id,nome", ignoreDuplicates: true }).then(({ error }) => {
      if (error) console.warn("Cadastro auxiliar de motorista:", error.message);
    }) : Promise.resolve(),
  ]);
  return id;
}

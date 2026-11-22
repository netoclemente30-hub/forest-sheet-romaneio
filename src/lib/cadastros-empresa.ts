import { supabase } from "@/integrations/supabase/client";
import { comCache } from "@/lib/offline/cache";

/**
 * A escolha do superadmin é obrigatória em telas operacionais.
 * "Todas as empresas" serve apenas para relatórios, nunca para cadastros,
 * carregamentos ou recebimentos de madeira.
 */
export function empresaDaOperacao(
  isSuperAdmin: boolean,
  empresaDoUsuario: string | null,
  empresaSelecionada: string | null,
): string | null {
  return isSuperAdmin ? empresaSelecionada : empresaDoUsuario;
}

/** Defesa adicional ao RLS e contra retornos tardios na troca de empresa. */
export function somenteDaEmpresa<T extends { empresa_id: string }>(
  registros: T[] | null | undefined, empresa: string,
): T[] {
  if (!empresa) return [];
  return (registros ?? []).filter((item) => item.empresa_id === empresa);
}

export async function listarCadastrosRomaneio(empresa: string) {
  if (!empresa) return { motoristas: [], veiculos: [] };
  const [motoristas, veiculos] = await Promise.all([
    comCache(`motoristas:${empresa}`, async () => {
      const { data, error } = await supabase.from('motoristas').select('nome,cpf,empresa_id').eq('empresa_id', empresa).order('nome');
      if (error) throw error;
      return somenteDaEmpresa(data, empresa);
    }, empresa),
    comCache(`veiculos:${empresa}`, async () => {
      const { data, error } = await supabase.from('veiculos').select('placa,tipo,empresa_id').eq('empresa_id', empresa).order('placa');
      if (error) throw error;
      return somenteDaEmpresa(data, empresa);
    }, empresa),
  ]);
  return { motoristas, veiculos };
}

export async function listarPatiosSerraria(empresa: string): Promise<{ nome: string; empresa_id: string }[]> {
  if (!empresa) return [];
  return comCache("patios-serraria:" + empresa, async () => {
    const { data, error } = await supabase.from("patios")
      .select("nome,empresa_id").eq("empresa_id", empresa).order("nome");
    if (error) throw new Error("Erro ao carregar pátios: " + error.message);
    return somenteDaEmpresa(data, empresa);
  });
}

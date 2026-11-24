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
  if (!empresa) return { motoristas: [], veiculos: [], clientes: [] as ClienteSalvo[] };
  const [motoristas, veiculos, clientes] = await Promise.all([
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
    comCache(`clientes:${empresa}`, async () => {
      const { data, error } = await supabase.from("romaneios").select("cliente,empresa_id").eq("empresa_id", empresa).not("cliente", "is", null).order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []).filter((x) => x.empresa_id === empresa).map((x) => x.cliente);
    }, empresa),
  ]);
  return { motoristas, veiculos, clientes: clientesUnicos(clientes) };
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

/** Clientes já usados nesta empresa, com documento como identidade e nome como fallback legado. */
export type ClienteSalvo = { nome: string } & Partial<Record<"documento" | "logradouro" | "numero" | "complemento" | "bairro" | "municipio" | "uf" | "cep", string>>;
export function clientesUnicos(lista: unknown[]): ClienteSalvo[] {
  const vistos = new Map<string, ClienteSalvo>();
  for (const c of lista) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const nome = typeof o["nome"] === "string" ? o["nome"].trim() : "";
    const documento=typeof o["documento"]==="string"?o["documento"].replace(/[./\s-]/g,"").toUpperCase():"";
    const chave=documento || nome.toLowerCase();
    if (nome && !vistos.has(chave)) vistos.set(chave, { ...(o as Record<string, string>), nome });
  }
  return [...vistos.values()];
}

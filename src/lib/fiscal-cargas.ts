import { supabase } from "@/integrations/supabase/client";
import { itensDeSerrada, itensDeToras, type DadosNfe } from "./nfe-txt";

export async function cargasFiscais(empresa: string) {
  const [toras, serrada] = await Promise.all([
    supabase
      .from("romaneios")
      .select("id,data,placa")
      .eq("empresa_id", empresa)
      .order("data", { ascending: false })
      .limit(100)
      .throwOnError(),
    supabase
      .from("romaneios_madeira_serrada")
      .select("id,data,numero_carga")
      .eq("empresa_id", empresa)
      .order("data", { ascending: false })
      .limit(100)
      .throwOnError(),
  ]);
  return [
    ...toras.data.map((r) => ({
      id: "toras/" + r.id,
      nome: "Toras · " + r.data + " · " + (r.placa || r.id),
    })),
    ...serrada.data.map((r) => ({
      id: "serrada/" + r.id,
      nome: "Serrada · " + r.data + " · " + r.numero_carga,
    })),
  ];
}

export async function importarCarga(empresa: string, origem: string): Promise<DadosNfe> {
  const [tipo, id] = origem.split("/");
  if (!id) throw new Error("Selecione um romaneio.");
  if (tipo === "toras") {
    const [{ data: r }, { data: itens }] = await Promise.all([
      supabase
        .from("romaneios")
        .select("*")
        .eq("empresa_id", empresa)
        .eq("id", id)
        .single()
        .throwOnError(),
      supabase
        .from("toras")
        .select("especie,nome_cientifico,volume")
        .eq("empresa_id", empresa)
        .eq("romaneio_id", id)
        .throwOnError(),
    ]);
    if (itens.length !== r.qtd_toras)
      throw new Error("Quantidade de toras divergente. Confira o romaneio.");
    return {
      tipo: "0",
      natureza: "ENTRADA DE MADEIRA EM TORA",
      numero: (r.placa || r.id) + " · " + r.data,
      data: r.data,
      placa: r.placa,
      reboque: r.julieta,
      cliente: clienteDoRomaneio(r.cliente),
      motorista: { nome: r.motorista || "", cpf: r.cpf || "" },
      itens: itensDeToras(itens),
    };
  }
  if (tipo !== "serrada") throw new Error("Origem desconhecida.");
  const { data: r } = await supabase
    .from("romaneios_madeira_serrada")
    .select("*")
    .eq("empresa_id", empresa)
    .eq("id", id)
    .single()
    .throwOnError();
  const { data: vinculos } = await supabase
    .from("romaneio_carga_pacotes")
    .select("pacote_id")
    .eq("empresa_id", empresa)
    .eq("romaneio_id", id)
    .throwOnError();
  const { data: itens } = await supabase
    .from("itens_pacote_serrado")
    .select("especie,tipo_peca,grossura,largura,total_pecas,volume_m3")
    .eq("empresa_id", empresa)
    .in(
      "pacote_id",
      vinculos.map((v) => v.pacote_id),
    )
    .throwOnError();
  if (itens.reduce((s, i) => s + i.total_pecas, 0) !== r.total_pecas)
    throw new Error("Quantidade de peças divergente. Confira a carga.");
  return {
    numero: r.numero_carga,
    data: r.data,
    cliente: { nome: r.cliente_nome, documento: r.cliente_documento },
    motorista: { nome: r.motorista_nome, cpf: r.motorista_cpf },
    placa: r.placa_veiculo,
    reboque: r.placa_reboque,
    itens: itensDeSerrada(itens),
  };
}

export function clienteDoRomaneio(c: unknown): NonNullable<DadosNfe["cliente"]> | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  const t = (k: string) => (typeof o[k] === "string" ? (o[k] as string).trim() : "");
  if (!t("nome") && !t("documento")) return null;
  return {
    nome: t("nome"), documento: t("documento"),
    endereco: { logradouro: t("logradouro"), numero: t("numero"), complemento: t("complemento"),
      bairro: t("bairro"), municipio: t("municipio"), uf: t("uf").toUpperCase(), cep: t("cep") },
  };
}

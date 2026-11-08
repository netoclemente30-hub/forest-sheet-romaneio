import type { Op } from "./fila";
import type { Tora } from "@/lib/data";
import { dadosDaEdicao, editarDe, validarEdicao, type EdicaoTora } from "@/lib/tora-edit";
import { fmtM3 } from "@/lib/volume";

export type CampoFila = { chave: string; rotulo: string; mode?: "numeric" | "decimal" | "text" };
const camposTora: CampoFila[] = [
  { chave: "plaquetaNova", rotulo: "Plaqueta azul", mode: "numeric" },
  { chave: "arvore", rotulo: "Nº árvore", mode: "numeric" },
  { chave: "secao", rotulo: "Secção" },
  { chave: "especie", rotulo: "Espécie (nome popular)" },
  { chave: "nome_cientifico", rotulo: "Nome científico" },
  { chave: "autex", rotulo: "AUTEX" },
  { chave: "volume", rotulo: "Volume (m³)", mode: "decimal" },
  { chave: "d_topo1", rotulo: "D. topo 1 (cm)", mode: "decimal" },
  { chave: "d_topo2", rotulo: "D. topo 2 (cm)", mode: "decimal" },
  { chave: "d_pe1", rotulo: "D. pé 1 (cm)", mode: "decimal" },
  { chave: "d_pe2", rotulo: "D. pé 2 (cm)", mode: "decimal" },
  { chave: "comprimento", rotulo: "Comprimento (m)", mode: "decimal" },
];

export function camposDaFila(op: Op): CampoFila[] {
  switch (op.tipo) {
    case "tora_insert": case "tora_update": return camposTora;
    case "tora_delete": return [{ chave: "plaqueta", rotulo: "Plaqueta azul", mode: "numeric" }];
    case "romaneio_recebido": return [{ chave: "patio", rotulo: "Pátio" }];
    case "toras_serradas": return [{ chave: "plaquetas", rotulo: "Plaquetas (separadas por vírgula)" }];
    case "romaneio_salvar": return [
      { chave: "placa", rotulo: "Placa do caminhão" }, { chave: "julieta", rotulo: "Placa do reboque" },
      { chave: "motorista", rotulo: "Motorista" }, { chave: "cpf", rotulo: "CPF" }, { chave: "data", rotulo: "Data" },
    ];
  }
}

export function rascunhoDaFila(op: Op, toras: Tora[]): Record<string, string> {
  if (op.tipo === "tora_insert" || op.tipo === "tora_update") {
    const base = op.tipo === "tora_update" ? toras.find((t) => t.empresa_id === op.empresa_id && t.plaqueta === op.plaqueta) : undefined;
    const dados = { ...base, ...op.dados };
    return Object.fromEntries(camposTora.map(({ chave }) => [chave, String(dados[chave === "plaquetaNova" ? "plaqueta" : chave] ?? (chave === "plaquetaNova" && op.tipo === "tora_update" ? op.plaqueta : ""))]));
  }
  if (op.tipo === "romaneio_salvar") return { ...op.cab };
  if (op.tipo === "romaneio_recebido") return { patio: op.patio };
  if (op.tipo === "tora_delete") return { plaqueta: String(op.plaqueta) };
  return { plaquetas: op.plaquetas.join(", ") };
}

export function edicaoDaFila(op: Op, valores: Record<string, string>): EdicaoTora | null {
  if (op.tipo !== "tora_insert" && op.tipo !== "tora_update") return null;
  return {
    ...Object.fromEntries(camposTora.map(({ chave }) => [chave, valores[chave] ?? ""])),
    plaqueta: op.tipo === "tora_update" ? op.plaqueta : -1,
    empresa_id: op.tipo === "tora_update" ? op.empresa_id : String(op.dados.empresa_id ?? ""),
  } as EdicaoTora;
}

/** Only editable fields change; company, origin, targets and captured audit remain intact. */
export function corrigirOp(op: Op, valores: Record<string, string>, toras: Tora[]): Op {
  const e = edicaoDaFila(op, valores);
  if (e && (op.tipo === "tora_insert" || op.tipo === "tora_update")) {
    const erro = validarEdicao(e, toras);
    if (erro) throw new Error(erro);
    const dados = dadosDaEdicao(e);
    const log = op.log ? { ...op.log, detalhe: `Plaqueta ${dados.plaqueta} · ${dados.especie ?? "sem espécie"} · árvore ${dados.arvore}${dados.secao ? `-${dados.secao}` : ""} · ${fmtM3(dados.volume)} m³ · corrigido antes do envio` } : undefined;
    return op.tipo === "tora_update" ? { ...op, dados: { ...op.dados, ...dados }, autex: dados.autex, log } : { ...op, dados: { ...op.dados, ...dados }, log };
  }
  const positivo = (s: string) => {
    const n = Number(s.trim());
    if (!Number.isSafeInteger(n) || n <= 0) throw new Error("Informe uma plaqueta inteira maior que zero");
    return n;
  };
  switch (op.tipo) {
    case "tora_delete": return { ...op, plaqueta: positivo(valores.plaqueta ?? "") };
    case "toras_serradas": return { ...op, plaquetas: [...new Set((valores.plaquetas ?? "").split(/[,;\s]+/).filter(Boolean).map(positivo))].map((n) => n) };
    case "romaneio_recebido": {
      const patio = valores.patio?.trim();
      if (!patio) throw new Error("Informe o pátio");
      return { ...op, patio };
    }
    case "romaneio_salvar": {
      if (!valores.placa?.trim() || !valores.motorista?.trim() || !valores.data?.trim()) throw new Error("Preencha placa, motorista e data");
      return { ...op, cab: { placa: valores.placa.trim().toUpperCase(), julieta: valores.julieta?.trim().toUpperCase() ?? "", motorista: valores.motorista.trim(), cpf: valores.cpf?.trim() ?? "", data: valores.data } };
    }
    default: throw new Error("Lançamento inválido");
  }
}
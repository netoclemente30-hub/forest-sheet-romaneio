import type { Op } from "./fila";
import type { Tora } from "@/lib/data";
import { dadosDaEdicao, validarEdicao, type EdicaoTora } from "@/lib/tora-edit";
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
    case 'pacote_serrado_salvar': return [{chave:'numero',rotulo:'Número do pacote'},{chave:'autex',rotulo:'AUTEX'},{chave:'data',rotulo:'Data'},{chave:'observacoes',rotulo:'Observações'}];
    case "tora_insert": case "tora_update": return camposTora;
    case "tora_delete": return [{ chave: "plaqueta", rotulo: "Plaqueta azul", mode: "numeric" }];
    case "romaneio_recebido": return [{ chave: "patio", rotulo: "Pátio" }];
    case "toras_serradas": return [{ chave: "plaquetas", rotulo: "Plaquetas (separadas por vírgula)" }];
    case "arvore_gps": return [{ chave: "latitude", rotulo: "Latitude", mode: "decimal" }, { chave: "longitude", rotulo: "Longitude", mode: "decimal" }, { chave: "gps_precisao", rotulo: "Precisão GPS (m)", mode: "decimal" }];
    case "rastro_salvar": case "arrasto_arvore": case "transferencia_explanada": case "arrasto_toras": case "aguardando_insert": case "aguardando_update": case "aguardando_impressa": return [];
    case "romaneio_salvar": return [
      { chave: "placa", rotulo: "Placa do caminhão" }, { chave: "julieta", rotulo: "Placa do reboque" },
      { chave: "motorista", rotulo: "Motorista" }, { chave: "cpf", rotulo: "CPF" }, { chave: "data", rotulo: "Data" },
    ];
  }
}

export function rascunhoDaFila(op: Op, toras: Tora[]): Record<string, string> {
  if(op.tipo==='pacote_serrado_salvar')return {...op.cab};
  if (op.tipo === "tora_insert" || op.tipo === "tora_update") {
    const base = op.tipo === "tora_update" ? toras.find((t) => t.empresa_id === op.empresa_id && t.plaqueta === op.plaqueta) : undefined;
    const dados: Record<string, unknown> = { ...base, ...op.dados };
    return Object.fromEntries(camposTora.map(({ chave }) => [chave, String(dados[chave === "plaquetaNova" ? "plaqueta" : chave] ?? (chave === "plaquetaNova" && op.tipo === "tora_update" ? op.plaqueta : ""))]));
  }
  if (op.tipo === "romaneio_salvar") return { ...op.cab };
  if (op.tipo === "romaneio_recebido") return { patio: op.patio };
  if (op.tipo === "arvore_gps") return { latitude: String(op.dados.latitude), longitude: String(op.dados.longitude), gps_precisao: String(op.dados.gps_precisao ?? "") };
  if (op.tipo === "rastro_salvar" || op.tipo === "arrasto_arvore" || op.tipo === "transferencia_explanada" || op.tipo === "arrasto_toras" || op.tipo === "aguardando_insert" || op.tipo === "aguardando_update" || op.tipo === "aguardando_impressa") return {};
  if (op.tipo === "tora_delete") return { plaqueta: String(op.plaqueta) };
  return { plaquetas: op.plaquetas.join(", ") };
}

export function edicaoDaFila(op: Op, valores: Record<string, string>): EdicaoTora | null {
  if (op.tipo !== "tora_insert" && op.tipo !== "tora_update") return null;
  return {
    ...Object.fromEntries(camposTora.map(({ chave }) => [chave, valores[chave] ?? ""])),
    plaqueta: op.tipo === "tora_update" ? op.plaqueta : -1,
    empresa_id: op.tipo === "tora_update" ? op.empresa_id : String(op.dados["empresa_id"] ?? ""),
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
    return op.tipo === "tora_update" ? { ...op, dados: { ...op.dados, ...dados }, autex: dados.autex, ...(log ? { log } : {}) } : { ...op, dados: { ...op.dados, ...dados }, ...(log ? { log } : {}) };
  }
  const positivo = (s: string) => {
    const n = Number(s.trim());
    if (!Number.isSafeInteger(n) || n <= 0) throw new Error("Informe uma plaqueta inteira maior que zero");
    return n;
  };
  switch (op.tipo) {
    case 'pacote_serrado_salvar': {
      if(!valores['numero']?.trim()||!valores['data'])throw new Error('Informe número e data');
      return {...op,cab:{numero:valores['numero'].trim(),autex:valores['autex']??'',data:valores['data'],observacoes:valores['observacoes']??''}};
    }
    case "arvore_gps": {
      const latitude = Number(valores["latitude"]);
      const longitude = Number(valores["longitude"]);
      const precisaoTexto = valores["gps_precisao"]?.trim();
      const gps_precisao = precisaoTexto ? Number(precisaoTexto) : null;
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("Informe latitude e longitude válidas");
      if (gps_precisao !== null && (!Number.isFinite(gps_precisao) || gps_precisao < 0)) throw new Error("Informe uma precisão GPS válida");
      return { ...op, dados: { ...op.dados, latitude, longitude, gps_precisao } };
    }
    case "tora_delete": return { ...op, plaqueta: positivo(valores["plaqueta"] ?? "") };
    case "toras_serradas": {
      const plaquetas = [...new Set((valores["plaquetas"] ?? "").split(/[,;\s]+/).filter(Boolean).map(positivo))];
      if (!plaquetas.length) throw new Error("Informe ao menos uma plaqueta");
      return { ...op, plaquetas };
    }
    case "romaneio_recebido": {
      const patio = valores["patio"]?.trim();
      if (!patio) throw new Error("Informe o pátio");
      return { ...op, patio };
    }
    case "romaneio_salvar": {
      const placa = valores["placa"]?.trim();
      const motorista = valores["motorista"]?.trim();
      const data = valores["data"]?.trim();
      if (!placa || !motorista || !data) throw new Error("Preencha placa, motorista e data");
      return { ...op, cab: { placa: placa.toUpperCase(), julieta: valores["julieta"]?.trim().toUpperCase() ?? "", motorista, cpf: valores["cpf"]?.trim() ?? "", data } };
    }
    default: throw new Error("Lançamento inválido");
  }
}
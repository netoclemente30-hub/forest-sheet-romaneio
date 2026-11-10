// TXT de importação da NF-e (layout delimitado por "|", versão 4.00) e resumo para WhatsApp.
// Preenche destinatário, itens e transporte; dados fiscais (CFOP, valores, impostos) ficam para o emissor.

export type ItemNfe = { codigo: string; descricao: string; ncm: string; unidade: string; quantidade: number; pecas?: number };
export type DadosNfe = {
  numero: string;
  data: string; // AAAA-MM-DD
  natureza?: string;
  cliente?: { nome: string; documento: string } | null;
  motorista?: { nome: string; cpf: string } | null;
  placa?: string | null;
  reboque?: string | null;
  itens: ItemNfe[];
  volumes?: number;
  observacao?: string;
};

export const NCM_TORA = "44034900";
export const NCM_SERRADA = "44072990";

const limpar = (s: string | null | undefined) => (s ?? "").replace(/[|\r\n]+/g, " ").trim();
const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const placaFmt = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const q4 = (n: number) => n.toFixed(4);

export function gerarTxtNfe(d: DadosNfe): string {
  const l: string[] = ["NOTAFISCAL|1|", "A|4.00|NFe|"];
  l.push(`B||${digitos(d.numero).slice(-8)}|${limpar(d.natureza ?? "VENDA DE MADEIRA")}|55|1|${digitos(d.numero).slice(-9)}|${d.data}T08:00:00-04:00|${d.data}T08:00:00-04:00|1|1||1|1||2|1|0|1|0|ManejoFlorestal||||`);
  if (d.cliente && (d.cliente.nome || d.cliente.documento)) {
    l.push(`E|${limpar(d.cliente.nome)}|9||||||`);
    const doc = digitos(d.cliente.documento);
    if (doc.length === 14) l.push(`E02|${doc}|`);
    else if (doc.length === 11) l.push(`E03|${doc}|`);
  }
  d.itens.forEach((it, i) => {
    l.push(`H|${i + 1}|${it.pecas ? `${it.pecas} pecas` : ""}|`);
    l.push(`I|${limpar(it.codigo)}|SEM GTIN|${limpar(it.descricao)}|${digitos(it.ncm)}||||||||${it.unidade}|${q4(it.quantidade)}|||SEM GTIN|${it.unidade}|${q4(it.quantidade)}||||||1||||`);
  });
  l.push("X|0|");
  if (d.motorista && (d.motorista.nome || d.motorista.cpf)) {
    l.push(`X03|${limpar(d.motorista.nome)}|||||`);
    if (digitos(d.motorista.cpf).length === 11) l.push(`X05|${digitos(d.motorista.cpf)}|`);
  }
  if (d.placa) l.push(`X18|${placaFmt(d.placa)}|||`);
  if (d.reboque) l.push(`X22|${placaFmt(d.reboque)}|||`);
  l.push(`X26|${d.volumes ?? d.itens.length}|MADEIRA||||||`);
  const total = d.itens.reduce((n, i) => n + i.quantidade, 0);
  const inf = [`Romaneio ${limpar(d.numero)}`, `Volume total ${q4(total)} m3`, d.motorista?.nome && `Motorista ${limpar(d.motorista.nome)}`, d.observacao && limpar(d.observacao)].filter(Boolean).join(" - ");
  l.push(`Z||${inf}|`);
  return l.join("\n") + "\n";
}

const m3 = (n: number) => n.toFixed(4).replace(".", ",");
const dataBr = (d: string) => d.split("-").reverse().join("/");

export function resumoWhatsapp(titulo: string, d: DadosNfe): string {
  const total = d.itens.reduce((n, i) => n + i.quantidade, 0);
  const pecas = d.itens.reduce((n, i) => n + (i.pecas ?? 0), 0);
  return [
    `*${titulo}*`,
    `Nº ${d.numero} · ${dataBr(d.data)}`,
    d.cliente?.nome && `Cliente: ${d.cliente.nome}${d.cliente.documento ? ` (${d.cliente.documento})` : ""}`,
    d.motorista?.nome && `Motorista: ${d.motorista.nome}${d.motorista.cpf ? ` · CPF ${d.motorista.cpf}` : ""}`,
    (d.placa || d.reboque) && `Placa: ${d.placa || "–"}${d.reboque ? ` · Reboque: ${d.reboque}` : ""}`,
    "",
    ...d.itens.map((i) => `• ${i.descricao}: ${i.pecas ? `${i.pecas} ${i.unidade === "M3" && titulo.includes("TORA") ? "toras" : "peças"} · ` : ""}${m3(i.quantidade)} m³`),
    "",
    `*Total: ${pecas ? `${pecas} ${titulo.includes("TORA") ? "toras" : "peças"} · ` : ""}${m3(total)} m³*`,
  ].filter((x) => x !== undefined && x !== null && x !== false).join("\n");
}

export function linkWhatsapp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

// Itens agrupados por espécie a partir das toras de um romaneio.
export function itensDeToras(toras: { especie: string | null; nome_cientifico?: string | null; volume: number | string }[]): ItemNfe[] {
  const m = new Map<string, ItemNfe>();
  for (const t of toras) {
    const esp = t.especie || "Sem espécie";
    const it = m.get(esp) ?? { codigo: `TORA-${esp.toUpperCase().slice(0, 12)}`, descricao: `Madeira em tora ${esp}${t.nome_cientifico ? ` (${t.nome_cientifico})` : ""}`, ncm: NCM_TORA, unidade: "M3", quantidade: 0, pecas: 0 };
    it.quantidade += Number(t.volume) || 0;
    it.pecas = (it.pecas ?? 0) + 1;
    m.set(esp, it);
  }
  return [...m.values()].sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
}

// Itens agrupados por espécie e bitola a partir dos pacotes de uma carga serrada.
export function itensDeSerrada(itens: { especie: string; tipo_peca: string; grossura: number | string; largura: number | string; total_pecas: number; volume_m3: number | string }[]): ItemNfe[] {
  const m = new Map<string, ItemNfe>();
  for (const i of itens) {
    const bit = `${Number(i.grossura)}x${Number(i.largura)}`;
    const k = `${i.especie}|${i.tipo_peca}|${bit}`;
    const it = m.get(k) ?? { codigo: `SER-${i.especie.toUpperCase().slice(0, 8)}-${bit}`, descricao: `Madeira serrada ${i.especie} ${i.tipo_peca} ${bit} cm`, ncm: NCM_SERRADA, unidade: "M3", quantidade: 0, pecas: 0 };
    it.quantidade += Number(i.volume_m3) || 0;
    it.pecas = (it.pecas ?? 0) + i.total_pecas;
    m.set(k, it);
  }
  return [...m.values()].sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
}

// Movimento do dia (data local AAAA-MM-DD).
export function hojeLocal(agora = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}
const diaDe = (iso: string | null | undefined) => (iso ? hojeLocal(new Date(iso)) : "");

export function movimentoDoDia(
  hoje: string,
  romaneios: { recebido_em: string | null; qtd_toras: number; total_volume: number | string; data: string }[],
  toras: { serrada_em: string | null; volume: number | string }[],
  cargasSerradas: { data: string; total_volume_m3: number | string }[],
) {
  const recebidos = romaneios.filter((r) => diaDe(r.recebido_em) === hoje);
  const serradas = toras.filter((t) => diaDe(t.serrada_em) === hoje);
  const cargasTora = romaneios.filter((r) => r.data === hoje);
  const cargasSer = cargasSerradas.filter((c) => c.data === hoje);
  return {
    recebidas: recebidos.reduce((n, r) => n + r.qtd_toras, 0),
    volRecebido: recebidos.reduce((n, r) => n + Number(r.total_volume), 0),
    serradas: serradas.length,
    volSerrado: serradas.reduce((n, t) => n + Number(t.volume), 0),
    cargas: cargasTora.length + cargasSer.length,
    volCargas: cargasTora.reduce((n, r) => n + Number(r.total_volume), 0) + cargasSer.reduce((n, c) => n + Number(c.total_volume_m3), 0),
  };
}

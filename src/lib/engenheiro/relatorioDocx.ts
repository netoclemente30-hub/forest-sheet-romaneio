import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { resumo } from "./triagem";
import { avaliarCenso } from "./camadas";
import type { Estado, Projeto } from "./projeto";

const cell = (text: string, bold = false) =>
  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold })] })] });
export async function gerarRelatorioPMFSPOA(s: Estado, p: Projeto) {
  const prop = s.propriedades.find((x) => x.id === p.propriedadeId),
    cliente = s.clientes.find((x) => x.id === prop?.clienteId);
  const areas = s.uts.filter((u) => u.projetoId === p.id).reduce((n, u) => n + u.areaHa, 0),
    stats = resumo(s, p.id),
    arvores = avaliarCenso(s, p.id);
  const protegidas = arvores.filter((a) => a.destinacao === "PROIBIDA_APP").length;
  const header = [
    "Espécie",
    "UT",
    "Indivíduos",
    "Corte m³",
    "Remanescente m³",
    "Porta-semente m³",
    "Protegido m³",
    "Área basal m²",
  ];
  const rows = stats.map((r) => {
    const a = arvores.filter((x) => x.ut === r.utId && x.especieId === r.codigo);
    const vol = (dest: string) =>
      a.filter((x) => x.destinacao === dest).reduce((n, x) => n + x.volume, 0);
    return [
      r.especie,
      r.ut,
      String(r.total),
      vol("CORTE").toFixed(3),
      vol("REMANESCENTE").toFixed(3),
      vol("PORTA_SEMENTE").toFixed(3),
      vol("PROIBIDA_APP").toFixed(3),
      r.areaBasal.toFixed(4),
    ];
  });
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: header.map((x) => cell(x, true)) }),
      ...rows.map((row) => new TableRow({ children: row.map((x) => cell(x)) })),
    ],
  });
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "RELATÓRIO TÉCNICO FLORESTAL",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: "Plano de Manejo Florestal Sustentável / Plano Operacional Anual",
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "1. Identificação", heading: HeadingLevel.HEADING_1 }),
          new Paragraph(`Cliente: ${cliente?.nome ?? "—"}`),
          new Paragraph(`Propriedade: ${prop?.nome ?? "—"}`),
          new Paragraph(`Projeto: ${p.nome} (${p.tipo})`),
          new Paragraph(
            `CAR: ${prop && "car" in prop ? ((prop as typeof prop & { car?: string }).car ?? "Não informado") : "Não informado"}`,
          ),
          new Paragraph(
            `Área total: ${prop && "areaTotalHa" in prop ? ((prop as typeof prop & { areaTotalHa?: number }).areaTotalHa ?? "Não informada") : "Não informada"} ha`,
          ),
          new Paragraph(`Área efetiva de manejo: ${areas.toFixed(2)} ha (soma das UT cadastradas)`),
          new Paragraph(
            `Parâmetros configurados no projeto: intensidade alvo ${p.intensidadeMax} m³/ha; percentual mínimo de porta-sementes ${p.percentualSementes}%.`,
          ),
          new Paragraph({
            text: "2. Volumetria e estoque por espécie / UT",
            heading: HeadingLevel.HEADING_1,
          }),
          table,
          new Paragraph({ text: "3. Resumo estatístico", heading: HeadingLevel.HEADING_1 }),
          new Paragraph(
            `Árvores avaliadas: ${arvores.length}; espécies representadas: ${new Set(arvores.map((a) => a.especieId)).size}; volume estimado total: ${arvores.reduce((n, a) => n + a.volume, 0).toFixed(3)} m³; árvores protegidas/bloqueadas: ${protegidas}.`,
          ),
          new Paragraph({ text: "4. Metodologia e ressalvas", heading: HeadingLevel.HEADING_1 }),
          new Paragraph(
            "Área basal calculada por G = π × DAP² / 4, com DAP em metros. Volume estimado pela equação parametrizada da espécie, quando cadastrada, ou G × altura comercial × fator de forma. Destinações e restrições espaciais são recalculadas contra as camadas locais cadastradas no momento da geração.",
          ),
          new Paragraph(
            "Este documento é editável e constitui relatório preliminar gerado dos dados locais. Parâmetros, áreas e restrições devem ser conferidos pelo responsável técnico com documentos autorizativos e legislação vigente. Não equivale a aprovação, ART ou transmissão ao Sinaflor/órgão ambiental.",
          ),
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}

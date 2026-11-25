<<<<<<< HEAD
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
=======
import { avaliarCenso, areaHa, poligonos } from "./camadas";
import { resumo } from "./triagem";
import type { Estado } from "./projeto";

export type InfoRelatorio = {
  car: string;
  areaTotalHa?: number;
  areaManejoHa?: number;
  responsavel: string;
  registro: string;
};
type Grupo = { n: number; v: number };
export type LinhaEspecie = {
  especie: string;
  cientifico: string;
  corte: Grupo;
  remanescente: Grupo;
  sementes: Grupo;
  protegidas: Grupo;
};

export function dadosRelatorio(s: Estado, pid: string, info: InfoRelatorio) {
  const p = s.projetos.find((p) => p.id === pid);
  if (!p) throw new Error("Projeto ausente.");
  const prop = s.propriedades.find((i) => i.id === p.propriedadeId);
  const cliente = s.clientes.find((c) => c.id === prop?.clienteId);
  const arvores = avaliarCenso(s, pid);
  const uts = s.uts.filter((u) => u.projetoId === pid);
  const limite = s.camadas.filter((c) => c.projetoId === pid && c.tipo === "Limite_UPA");
  const areaDesenhada = limite.reduce((n, c) => n + areaHa(c.geojson), 0);
  const areaTotalHa = info.areaTotalHa ?? (areaDesenhada || undefined);
  const areaManejoHa = info.areaManejoHa ?? (uts.reduce((n, u) => n + u.areaHa, 0) || undefined);
  const chave = { CORTE: "corte", REMANESCENTE: "remanescente", PORTA_SEMENTE: "sementes", PROIBIDA_APP: "protegidas" } as const;
  const porEspecie = new Map<string, LinhaEspecie>();
  for (const a of arvores) {
    const e = s.especies.find((e) => e.projetoId === pid && e.codigo === a.especieId)!;
    const l =
      porEspecie.get(e.codigo) ??
      ({
        especie: e.nomePopular,
        cientifico: e.nomeCientifico,
        corte: { n: 0, v: 0 },
        remanescente: { n: 0, v: 0 },
        sementes: { n: 0, v: 0 },
        protegidas: { n: 0, v: 0 },
      } satisfies LinhaEspecie);
    const g = l[chave[a.destinacao]];
    g.n++;
    g.v += a.volume;
    porEspecie.set(e.codigo, l);
  }
  const especies = [...porEspecie.values()].sort((a, b) => a.especie.localeCompare(b.especie));
  const vols = arvores.map((a) => a.volume);
  const n = vols.length;
  const media = n ? vols.reduce((x, y) => x + y, 0) / n : 0;
  const desvio = n > 1 ? Math.sqrt(vols.reduce((x, v) => x + (v - media) ** 2, 0) / (n - 1)) : 0;
  const volCorte = arvores.filter((a) => a.destinacao === "CORTE").reduce((x, a) => x + a.volume, 0);
  const estat = {
    n,
    volumeTotal: vols.reduce((x, y) => x + y, 0),
    areaBasal: arvores.reduce((x, a) => x + a.areaBasal, 0),
    dapMedio: n ? arvores.reduce((x, a) => x + a.dapCm, 0) / n : 0,
    volumeMedio: media,
    desvio,
    cv: media ? (100 * desvio) / media : 0,
    volCorte,
    intensidade: areaManejoHa ? volCorte / areaManejoHa : 0,
    emApp: arvores.filter((a) => a.alertas.some((t) => t.includes("APP"))).length,
    poligonosApp: poligonos(s, pid, "APP").length,
  };
  return { p, prop, cliente, uts, areaTotalHa, areaManejoHa, especies, estat, porUt: resumo(s, pid), info };
}

const f = (v: number, d = 3) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export async function gerarRelatorioDocx(s: Estado, pid: string, info: InfoRelatorio): Promise<Blob> {
  const d = dadosRelatorio(s, pid, info);
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType,
    WidthType, BorderStyle, ShadingType, Header, Footer, PageNumber, LevelFormat,
  } = await import("docx");
  const borda = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };
  const cel = (t: string, w: number, cab = false, dir = false) =>
    new TableCell({
      borders: bordas,
      width: { size: w, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      ...(cab ? { shading: { fill: "DDE7DA", type: ShadingType.CLEAR } } : {}),
      children: [
        new Paragraph({
          alignment: dir ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [new TextRun({ text: t, bold: cab, size: 17 })],
        }),
      ],
    });
  const tabela = (larguras: number[], cab: string[], linhas: string[][]) =>
    new Table({
      width: { size: larguras.reduce((a, b) => a + b, 0), type: WidthType.DXA },
      columnWidths: larguras,
      rows: [
        new TableRow({ tableHeader: true, children: cab.map((t, i) => cel(t, larguras[i]!, true)) }),
        ...linhas.map(
          (l) => new TableRow({ children: l.map((t, i) => cel(t, larguras[i]!, false, i > 0)) }),
        ),
      ],
    });
  const h = (t: string, nivel: 1 | 2 = 1) =>
    new Paragraph({ heading: nivel === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, children: [new TextRun(t)] });
  const par = (t: string) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun(t)] });
  const item = (rot: string, val: string) =>
    new Paragraph({
      numbering: { reference: "itens", level: 0 },
      children: [new TextRun({ text: `${rot}: `, bold: true }), new TextRun(val || "não informado")],
    });
  const ha = (v?: number) => (v ? `${f(v, 4)} ha` : "");
  const soma = (k: "corte" | "remanescente" | "sementes" | "protegidas") =>
    d.especies.reduce((a, e) => ({ n: a.n + e[k].n, v: a.v + e[k].v }), { n: 0, v: 0 });
  const g = (x: { n: number; v: number }) => [String(x.n), f(x.v)];
  const esp = d.especies.map((e) => [
    `${e.especie} (${e.cientifico})`,
    ...g(e.corte), ...g(e.remanescente), ...g(e.sementes), ...g(e.protegidas),
  ]);
  esp.push(["TOTAL", ...g(soma("corte")), ...g(soma("remanescente")), ...g(soma("sementes")), ...g(soma("protegidas"))]);
  const W = 9026;
  const doc = new Document({
    creator: "Gestor Florestal",
    title: `Relatório técnico ${d.p.tipo} — ${d.p.nome}`,
    styles: {
      default: { document: { run: { font: "Arial", size: 21 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, font: "Arial" }, paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 24, bold: true, font: "Arial" }, paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: [{ reference: "itens", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: `${d.p.tipo} · ${d.p.nome}`, size: 16, color: "666666" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ size: 16, children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES] })] })] }) },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
          children: [new TextRun({ text: d.p.tipo === "PMFS" ? "PLANO DE MANEJO FLORESTAL SUSTENTÁVEL" : "PLANO OPERACIONAL ANUAL", bold: true, size: 30 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
          children: [new TextRun({ text: "Relatório técnico de inventário florestal 100%", size: 24 })] }),
        h("1. Identificação"),
        item("Cliente / detentor", d.cliente?.nome ?? ""),
        item("Propriedade", d.prop?.nome ?? ""),
        item("Projeto", `${d.p.nome} (${d.p.tipo})`),
        item("CAR", d.info.car),
        item("Área total da propriedade", ha(d.areaTotalHa)),
        item("Área de efetivo manejo", ha(d.areaManejoHa)),
        item("Unidades de trabalho", d.uts.map((u) => `${u.nome} (${f(u.areaHa, 2)} ha)`).join("; ")),
        item("Sistema de coordenadas", `WGS84 · UTM ${d.p.zona}${d.p.hemisferio}`),
        item("Responsável técnico", [d.info.responsavel, d.info.registro].filter(Boolean).join(" — ")),
        h("2. Volumetria e estoque por espécie"),
        par("N = número de árvores; V = volume em m³. Protegidas incluem espécies imunes/proibidas e árvores em APP."),
        tabela([2026, 875, 875, 875, 875, 875, 875, 875, 875],
          ["Espécie", "Corte N", "Corte V", "Rem. N", "Rem. V", "P.Sem. N", "P.Sem. V", "Prot. N", "Prot. V"], esp),
        h("3. Resumo por UT", 1),
        tabela([1600, 2526, 800, 1100, 1000, 1000, 1000],
          ["UT", "Espécie", "N", "G (m²)", "V (m³)", "Corte m³/ha", "Sement. %"],
          d.porUt.map((r) => [r.ut, r.especie, String(r.total), f(r.areaBasal, 4), f(r.volume), f(r.corteHa), f(r.percentual, 1)])),
        h("4. Resumo estatístico"),
        tabela([5026, 4000], ["Indicador", "Valor"], [
          ["Árvores inventariadas", String(d.estat.n)],
          ["Volume total (m³)", f(d.estat.volumeTotal)],
          ["Área basal total (m²)", f(d.estat.areaBasal, 4)],
          ["DAP médio (cm)", f(d.estat.dapMedio, 1)],
          ["Volume médio por árvore (m³)", f(d.estat.volumeMedio, 4)],
          ["Desvio padrão do volume (m³)", f(d.estat.desvio, 4)],
          ["Coeficiente de variação (%)", f(d.estat.cv, 1)],
          ["Volume autorizado para corte (m³)", f(d.estat.volCorte)],
          ["Intensidade de corte (m³/ha)", d.areaManejoHa ? f(d.estat.intensidade) : "informe a área de manejo"],
          ["Intensidade máxima configurada (m³/ha)", f(d.p.intensidadeMax, 2)],
          ["Árvores em APP", String(d.estat.emApp)],
        ].map(([a, b]) => [a!, b!])),
        h("5. Metodologia"),
        par("Inventário florestal 100% (censo) dos indivíduos com DAP igual ou superior ao diâmetro mínimo de medição das espécies de interesse, com georreferenciamento individual por GPS em WGS84 e conferência em UTM."),
        par("O DAP foi obtido diretamente ou pela conversão DAP = CAP/π. A área basal individual foi calculada por g = π·DAP²/40000 (m²). O volume foi estimado pela equação de volume parametrizada da espécie (V = a·DAP^b·H^c) quando cadastrada, ou por V = g·Hc·ff, com fator de forma ff informado por espécie."),
        par(`As árvores foram classificadas em corte, remanescentes, porta-sementes e protegidas. Foram enquadradas como remanescentes as árvores abaixo do DMC, fora do limite da UT ou de espécies raras; como protegidas as espécies imunes/proibidas e as localizadas em Área de Preservação Permanente. A retenção mínima configurada de porta-sementes é de ${f(d.p.percentualSementes, 1)}% dos indivíduos por espécie em cada UT.`),
        par("As Áreas de Preservação Permanente foram delimitadas a partir das camadas de hidrografia e nascentes, com faixa marginal definida pelo responsável técnico, e as árvores contidas nessas áreas (incluindo a borda) foram excluídas do corte."),
        par("Este documento é um rascunho editável gerado automaticamente e deve ser revisado e assinado pelo responsável técnico antes de qualquer protocolo."),
      ],
    }],
  });
  void W;
>>>>>>> 8a014b752aa100f7229f54256af8852f7952f1ac
  return Packer.toBlob(doc);
}

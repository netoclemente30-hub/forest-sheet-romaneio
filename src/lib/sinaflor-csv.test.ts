import { describe, expect, it } from "vitest";
import type { Arvore, Tora } from "./data";
import {
  exportarAbatidasCsv,
  exportarTracadasCsv,
  linhaTracamento,
  selecionarAbatidas,
  selecionarTracadas,
  type FiltroSinaflor,
} from "./sinaflor-csv";

const f: FiltroSinaflor = { empresaId: "emp-1", autex: "AUTEX 101", inicio: "2026-10-29", fim: "2026-10-29" };

function arvore(numero: number, alteracoes: Record<string, unknown> = {}): Arvore {
  return {
    numero, empresa_id: "emp-1", autex: f.autex,
    abatida_em: "2026-10-29T16:30:00-04:00", ...alteracoes,
  } as unknown as Arvore;
}

function tora(arvoreNumero: number, secao: string, alteracoes: Record<string, unknown> = {}): Tora {
  return {
    plaqueta: arvoreNumero, arvore: arvoreNumero, secao,
    empresa_id: "emp-1", autex: f.autex, origem: "manejo",
    created_at: "2026-10-29T16:30:00-04:00",
    d_topo1: 58, d_topo2: 59, d_pe1: 49, d_pe2: 51,
    comprimento: 6.6, ...alteracoes,
  } as unknown as Tora;
}

async function texto(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob, "UTF-8");
  });
}

describe("CSV SINAFLOR — modelos fornecidos", () => {
  it("gera apenas Número da árvore, sem colunas extras, e remove repetição na AUTEX", async () => {
    const ls = [
      arvore(7452), arvore(7451), arvore(7451),
      arvore(7477, { autex: "outra" }), arvore(7481, { empresa_id: "emp-2" }),
      arvore(7549, { abatida_em: null }),
    ];
    expect(selecionarAbatidas(ls, f).map((a) => a.numero)).toEqual([7451, 7452]);
    const a = exportarAbatidasCsv(ls, f);
    expect(a.nome).toContain("arvores_abatidas_sinaflor_");
    expect(await texto(a.blob)).toBe("Número da árvore\n7451\n7452\n");
  });

  it("gera as cinco colunas de traçamento com ponto e vírgula, decimal com vírgula e médias em metros", async () => {
    const t = tora(7758, "A");
    expect(linhaTracamento(t)).toBe("7758;A;0,585;0,5;6,6");
    const a = exportarTracadasCsv([t], f);
    expect(a.nome).toContain("toras_tracadas_sinaflor_");
    expect(await texto(a.blob)).toBe(
      "Nº Árvore;Secção;Diâmetro 1 (m);Diâmetro 2 (m);Comprimento (m)\r\n" +
      "7758;A;0,585;0,5;6,6\r\n",
    );
  });
});

describe("filtros, consistência e duplicidade", () => {
  it("filtra pela data do abate (não a do lançamento da tora), incluindo início e fim", () => {
    const ls = [
      arvore(1, { abatida_em: "2026-10-28T13:00:00-04:00" }),
      arvore(2, { abatida_em: "2026-10-29T12:00:00-04:00" }),
      arvore(3, { abatida_em: "2026-10-30T12:00:00-04:00" }),
    ];
    expect(selecionarAbatidas(ls, f).map((a) => a.numero)).toEqual([2]);
  });

  it("separa AUTEX, empresa, origem e data de lançamento das toras", () => {
    const ls = [
      tora(1, "A"), tora(2, "A", { empresa_id: "emp-2" }),
      tora(3, "A", { autex: "outra" }),
      tora(4, "A", { origem: "serraria" }),
      tora(5, "A", { created_at: "2026-10-30T12:00:00-04:00" }),
    ];
    expect(selecionarTracadas(ls, f).validas.map((a) => a.arvore)).toEqual([1]);
  });

  it("não exporta seções sem medidas ou secções duplicadas", () => {
    const incompleta = tora(1, "A", { d_pe1: null });
    const duplicada = tora(2, "A", { plaqueta: 200 });
    const base = [incompleta, tora(2, "A"), duplicada];
    const grupo = selecionarTracadas(base, f);
    expect(grupo.incompletas).toHaveLength(1);
    expect(grupo.duplicadas).toHaveLength(1);
    expect(() => exportarTracadasCsv(base, f)).toThrow("sem secção ou medidas completas");
    expect(() => exportarTracadasCsv([tora(2, "A"), duplicada], f)).toThrow("repetida");
  });

  it("considera datas no horário de Rondônia, mesmo após 20h local", () => {
    const items = [arvore(10, { abatida_em: "2026-10-30T02:00:00Z" })];
    expect(selecionarAbatidas(items, f).map((a) => a.numero)).toEqual([10]);
  });

  it("impede secção com fórmula ou caractere de controle no CSV", () => {
    const grupo = selecionarTracadas([tora(123, "=1+1")], f);
    expect(grupo.incompletas).toHaveLength(1);
    expect(() => exportarTracadasCsv([tora(123, "=1+1")], f)).toThrow("incompletas");
  });

  it("recusa data inicial posterior à data final e AUTEX ausente", () => {
    expect(() => selecionarAbatidas([], { ...f, inicio: "2026-10-30" })).toThrow("posterior");
    expect(() => selecionarAbatidas([], { ...f, autex: "" })).toThrow("Escolha");
    expect(() => selecionarAbatidas([], { ...f, inicio: "2026-13-40" })).toThrow("Informe a data");
  });
});

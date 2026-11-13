import { expect, it } from "vitest";
import * as XLSX from "xlsx";
import { modeloFichaCampo } from "./modelo-ficha-campo";
import { lerBase, chaveArvore } from "./import-base";

it("modelo vazio não importa dados fictícios e aceita coordenadas preenchidas pelo engenheiro", async () => {
  const arquivo = modeloFichaCampo();
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error("Arquivo inválido"));
    reader.onerror = reject;
    reader.readAsArrayBuffer(arquivo.blob);
  });
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheet = workbook.Sheets["Ficha de campo"];
  if (!sheet) throw new Error("Ficha ausente");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  expect(lerBase(rows).size).toBe(0);
  rows.push([349, "Jatobá", 150, null, 20, null, "Explorável", "01", "Hymenaea courbaril", "AUTEX-TESTE", -9.123456, -63.654321]);
  const arvore = lerBase(rows).get(chaveArvore(349, "AUTEX-TESTE"));
  expect(arvore?.latitude).toBe(-9.123456);
  expect(arvore?.longitude).toBe(-63.654321);
  expect(arvore?.picada).toBe("01");
});
import { expect, it } from "vitest";
import { linhasPDF, type TextoPDF } from "./import-pdf";
import { lerBase, chaveArvore } from "./import-base";

const t = (str: string, x: number, y: number, width = 20): TextoPDF => ({ str, x, y, width });
it("extrai cabeçalho em duas linhas e continua a picada na página seguinte", () => {
  const pages = [
    [t("Picada: 3", 100, 710, 80), t("CAP", 260, 690), t("Altura", 300, 690), t("Volume", 350, 690), t("Nº", 130, 683, 10), t("Nome Vulgar", 166, 683, 66), t("Categoria", 400, 683, 50), t("(cm)", 260, 676), t("34", 133, 660, 12), t("Pequia", 149, 660, 35), t("224", 261, 660, 17), t("13", 310, 660, 12), t("3,6335", 347, 660, 32), t("Explorável", 390, 660, 50)],
    [t("Ficha de Campo do I.F. 100%", 200, 720, 200), t("35", 133, 690, 12), t("Abiurana", 149, 690, 45), t("152", 261, 690, 17), t("16", 310, 690, 12), t("2,0592", 347, 690, 32), t("Remanescente", 390, 690, 70), t("39,8378", 347, 675, 32)],
  ];
  const arvores = lerBase(linhasPDF(pages));
  expect(arvores.size).toBe(2);
  expect(arvores.get(chaveArvore(34, ""))?.nome_vulgar).toBe("Pequia");
  expect(arvores.get(chaveArvore(35, ""))?.volume).toBe(2.0592);
  expect(arvores.get(chaveArvore(35, ""))?.picada).toBe("3");
});
import * as XLSX from "xlsx";
import type { ArquivoGerado } from "./arquivo";

export function modeloFichaCampo(): ArquivoGerado {
  const workbook = XLSX.utils.book_new();
  const cabecalho = ["Número", "Nome vulgar", "CAP (cm)", "DAP (cm)", "Altura (m)", "Volume (m³)", "Categoria", "Picada", "Nome científico", "AUTEX", "Latitude", "Longitude"];
  const ficha = XLSX.utils.aoa_to_sheet([cabecalho]);
  ficha["!cols"] = [12, 24, 14, 14, 14, 16, 22, 12, 32, 26, 20, 20].map((wch) => ({ wch }));
  ficha["!autofilter"] = { ref: "A1:L101" };
  XLSX.utils.book_append_sheet(workbook, ficha, "Ficha de campo");
  const instrucoes = XLSX.utils.aoa_to_sheet([
    ["FICHA DE CAMPO COM COORDENADAS — SOLICITAÇÃO AO ENGENHEIRO"],
    ["Preencher a primeira aba, Ficha de campo, com uma árvore por linha, sem alterar os cabeçalhos."],
    ["Número, Nome vulgar, AUTEX, Latitude e Longitude devem identificar cada árvore do manejo."],
    ["Latitude e Longitude: graus decimais em WGS84 (EPSG:4326), preferencialmente com 6 ou mais casas decimais."],
    ["Usar valores negativos para latitude Sul e longitude Oeste; não enviar graus/minutos/segundos ou coordenadas UTM nessas colunas."],
    ["Se os dados estiverem em UTM ou outro sistema, o engenheiro deve convertê-los para WGS84 antes de preencher."],
    ["As coordenadas devem corresponder à localização real de cada árvore e ao mapa de exploração da mesma AUTEX."],
    ["CAP e DAP em centímetros; altura em metros; volume em metros cúbicos. DAP pode ficar vazio quando CAP estiver preenchido."],
    ["Informar nome científico, categoria e picada conforme o inventário aprovado. Não inventar medidas ou posições."],
    ["Importar somente a aba Ficha de campo no aplicativo. As outras abas são orientações e exemplo."],
    ["A aba Exemplo fictício é apenas ilustrativa e não representa nenhuma árvore ou manejo real."],
  ]);
  instrucoes["!cols"] = [{ wch: 135 }];
  XLSX.utils.book_append_sheet(workbook, instrucoes, "Orientações ao engenheiro");
  const exemplo = XLSX.utils.aoa_to_sheet([cabecalho, [1, "Jatobá", 150, null, 20, null, "Explorável", "01", "Hymenaea courbaril", "AUTEX-EXEMPLO", -9.123456, -63.654321]]);
  exemplo["!cols"] = ficha["!cols"];
  XLSX.utils.book_append_sheet(workbook, exemplo, "Exemplo fictício");
  return { nome: "modelo-ficha-campo-coordenadas.xlsx", blob: new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
}
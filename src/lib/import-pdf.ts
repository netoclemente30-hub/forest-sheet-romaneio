import { analisarBase, campoInventario, type ArvoreBase } from "./import-base";

export type TextoPDF = { str: string; x: number; y: number; width: number };
type Campo = keyof ArvoreBase;

/** Reconstitui células pela posição, não pela ordem interna dos objetos do PDF. */
export function linhasPDF(pages: TextoPDF[][]): unknown[][] {
  const rows: unknown[][] = [];
  let anchors: { campo: Campo; x: number }[] = [];
  for (const page of pages) {
    const lines: TextoPDF[][] = [];
    for (const item of [...page].filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x)) {
      const line = lines.at(-1);
      if (line && Math.abs((line[0]?.y ?? 0) - item.y) <= 3) line.push(item);
      else lines.push([item]);
    }
    let header: typeof anchors = [];
    for (const line of lines) {
      line.sort((a, b) => a.x - b.x);
      const texto = line.map((i) => i.str).join(" ");
      if (/^\s*(?:picada|faixa|trilha)\s*[:\-]/i.test(texto)) { rows.push([texto]); continue; }
      const found = line.flatMap((i) => { const campo = campoInventario(i.str); return campo ? [{ campo, x: i.x + i.width / 2 }] : []; });
      if (found.length >= 2) {
        header = [...header.filter((a) => !found.some((b) => b.campo === a.campo)), ...found];
        if (header.some((a) => a.campo === "numero") && header.some((a) => a.campo === "nome_vulgar") && header.length >= 3) {
          anchors = [...header].sort((a, b) => a.x - b.x);
          rows.push(anchors.map((a) => a.campo === "numero" ? "Número" : a.campo.replace(/_/g, " ")));
        }
        continue;
      }
      if (!anchors.length) continue;
      const cells = anchors.map(() => "");
      for (const item of line) {
        const center = item.x + item.width / 2;
        let nearest = 0;
        anchors.forEach((a, i) => {
          const next = anchors[i + 1];
          if (!next) return;
          const boundary = a.campo === "numero" && next.campo === "nome_vulgar" ? a.x + 10 : (a.x + next.x) / 2;
          if (center > boundary) nearest = i + 1;
        });
        cells[nearest] = `${cells[nearest]} ${item.str}`.trim();
      }
      rows.push(cells);
    }
  }
  return rows;
}

export async function lerPDFInventario(file: File, progress: (s: string) => void) {
  // Importado somente após escolher arquivo: pdf.js usa APIs do navegador.
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  const pages: TextoPDF[][] = [];
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      progress(`Lendo página ${p}/${pdf.numPages}…`);
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      pages.push(content.items.flatMap((item) => "str" in item ? [{ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width }] : []));
      page.cleanup();
    }
    const resultado = analisarBase(linhasPDF(pages));
    if (!resultado.arvores.size) throw new Error("Não foi possível reconhecer árvores neste PDF. Para fichas escaneadas, envie Excel ou um PDF com texto selecionável.");
    return resultado;
  } finally { await task.destroy(); }
}
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { Tora } from "@/lib/data";
import { qrTora } from "@/lib/tora-qr";

export type TamanhoEtiqueta = { largura: number; altura: number };

export const TAMANHOS_PADRAO: TamanhoEtiqueta[] = [
  { largura: 100, altura: 50 },
  { largura: 100, altura: 70 },
  { largura: 100, altura: 100 },
  { largura: 80, altura: 50 },
  { largura: 60, altura: 40 },
];

/** Limites aceitos (mm) para evitar arquivo inválido na impressora. */
export function tamanhoValido(t: TamanhoEtiqueta): boolean {
  return [t.largura, t.altura].every((n) => Number.isFinite(n) && n >= 25 && n <= 300);
}

const medida = (n: number | null) => (n === null ? "—" : Number(n).toFixed(2));

/** Escreve texto reduzindo a fonte até caber na largura disponível. */
function texto(doc: jsPDF, s: string, x: number, y: number, maxW: number, tamanho: number, bold = true, align: "left" | "center" = "left") {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  let fs = tamanho;
  doc.setFontSize(fs);
  while (fs > 4 && doc.getTextWidth(s) > maxW) { fs -= 0.5; doc.setFontSize(fs); }
  doc.text(s, x, y, { align, baseline: "top" });
  return (fs * 0.3528) * 1.15; // altura da linha em mm
}

/** Desenha o QR como vetor (quadrados pretos): nítido em qualquer impressora e arquivo bem leve. */
function desenharQr(doc: jsPDF, valor: string, x: number, y: number, lado: number) {
  const qr = QRCode.create(valor, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const c = lado / n;
  doc.setFillColor(0, 0, 0);
  for (let r = 0; r < n; r++) {
    let ini = -1;
    for (let col = 0; col <= n; col++) {
      const on = col < n && qr.modules.get(r, col);
      if (on && ini < 0) ini = col;
      if (!on && ini >= 0) { doc.rect(x + ini * c, y + r * c, (col - ini) * c, c, "F"); ini = -1; }
    }
  }
}

/** Gera um PDF com uma etiqueta por página, cada página no tamanho exato da etiqueta. */
export async function gerarEtiquetasPdf(toras: Tora[], t: TamanhoEtiqueta): Promise<jsPDF> {
  const { largura: W, altura: H } = t;
  const doc = new jsPDF({ unit: "mm", format: [W, H], orientation: W >= H ? "landscape" : "portrait" });
  const m = Math.max(2, Math.min(W, H) * 0.05);
  const k = Math.min(W / 100, H / 70); // escala relativa ao modelo 100×70 mm
  for (let i = 0; i < toras.length; i++) {
    const tora = toras[i];
    if (!tora) continue;
    if (i > 0) doc.addPage([W, H], W >= H ? "landscape" : "portrait");
    const qrMm = Math.min(H * 0.5, W * 0.4);
    desenharQr(doc, qrTora(tora), m, m, qrMm);
    const x = m + qrMm + m;
    const wTxt = W - x - m;
    let y = m;
    y += texto(doc, `Árvore ${tora.arvore} · Sec. ${tora.secao ?? "—"}`, x, y, wTxt, 11 * k);
    y += texto(doc, String(tora.plaqueta), x, y, wTxt, 28 * k);
    texto(doc, `Autorização: ${tora.autex ?? "Não informada"}`, x, y, wTxt, 8 * k);
    y = m + qrMm + m * 0.6;
    const wFull = W - 2 * m;
    y += texto(doc, tora.especie ?? "Não cadastrada", W / 2, y, wFull, 12 * k, true, "center");
    if (tora.nome_cientifico) y += texto(doc, tora.nome_cientifico, W / 2, y, wFull, 8 * k, false, "center");
    const col = wFull / 2;
    const linhas: [string, string][] = [
      [`${medida(tora.d_topo1)} × ${medida(tora.d_topo2)} cm (DF1×DF2)`, `C.: ${medida(tora.comprimento)} m`],
      [`${medida(tora.d_pe1)} × ${medida(tora.d_pe2)} cm (DF3×DF4)`, `VOL.: ${Number(tora.volume).toFixed(4)} m³`],
    ];
    for (const [a, b] of linhas) {
      if (y > H - m) break;
      const h1 = texto(doc, a, m, y, col - 1, 9 * k);
      const h2 = texto(doc, b, m + col, y, col, 9 * k);
      y += Math.max(h1, h2);
    }
  }
  return doc;
}

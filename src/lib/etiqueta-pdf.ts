import type { jsPDF } from "jspdf";
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

/** Mantém o primeiro lançamento primeiro; a plaqueta desempata lançamentos simultâneos. */
export function ordenarEtiquetasPorLancamento<T extends Pick<Tora, "created_at" | "plaqueta">>(toras: readonly T[]): T[] {
  const instante = (t: T) => {
    const valor = Date.parse(t.created_at);
    return Number.isFinite(valor) ? valor : 0;
  };
  return [...toras].sort((a, b) => instante(a) - instante(b) || a.plaqueta - b.plaqueta);
}

/** Escreve texto reduzindo a fonte até caber na largura disponível. */
export function textoEtiqueta(doc: jsPDF, s: string, x: number, y: number, maxW: number, tamanho: number, bold = true, align: "left" | "center" = "left") {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  let fs = tamanho;
  doc.setFontSize(fs);
  while (fs > 4 && doc.getTextWidth(s) > maxW) { fs -= 0.5; doc.setFontSize(fs); }
  doc.text(s, x, y, { align, baseline: "top" });
  return (fs * 0.3528) * 1.15; // altura da linha em mm
}

/** Desenha o QR como vetor (quadrados pretos): nítido em qualquer impressora e arquivo bem leve. */
export function desenharQr(doc: jsPDF, valor: string, x: number, y: number, lado: number) {
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
  const ordenadas = ordenarEtiquetasPorLancamento(toras);
  const { largura: W, altura: H } = t;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: [W, H], orientation: W >= H ? "landscape" : "portrait", compress: true });
  const m = Math.max(2, Math.min(W, H) * 0.05);
  for (let i = 0; i < ordenadas.length; i++) {
    const tora = ordenadas[i];
    if (!tora) continue;
    if (i > 0) doc.addPage([W, H], W >= H ? "landscape" : "portrait");
    const qrMm = Math.min(H - 2 * m, W * 0.48);
    desenharQr(doc, qrTora(tora), m, (H - qrMm) / 2, qrMm);
    const x = m + qrMm + m;
    const wTxt = W - x - m;
    const linhas: [string, number, boolean][] = [
      [`Árvore ${tora.arvore}`, 1.8, true],
      [`Secção ${tora.secao ?? "—"}`, 1.8, true],
      [`Plaqueta ${tora.plaqueta}`, 0.9, true],
      [tora.especie ?? "Não cadastrada", 1.1, true],
      ...(tora.nome_cientifico ? [[tora.nome_cientifico, 0.8, false] as [string, number, boolean]] : []),
      [`DF1×DF2: ${medida(tora.d_topo1)} × ${medida(tora.d_topo2)} cm`, 0.9, true],
      [`DF3×DF4: ${medida(tora.d_pe1)} × ${medida(tora.d_pe2)} cm`, 0.9, true],
      [`C.: ${medida(tora.comprimento)} m · VOL.: ${Number(tora.volume).toFixed(4)} m³`, 0.9, true],
      [`AUTEX: ${tora.autex ?? "Não informada"}`, 0.8, true],
    ];
    const hTot = H - 2 * m;
    const soma = linhas.reduce((t, l) => t + l[1], 0);
    let y = m;
    for (const [s, peso, bold] of linhas) {
      const slot = (hTot * peso) / soma;
      const fs = (slot / 1.15) / 0.3528;
      textoEtiqueta(doc, s, x, y + slot * 0.05, wTxt, fs, bold);
      y += slot;
    }
  }
  return doc;
}

/** Etiquetas das toras medidas no pátio aguardando identificação (sem árvore/seção). */
export async function gerarEtiquetasAguardandoPdf(toras: import("@/lib/toras-aguardando").ToraAguardando[], t: TamanhoEtiqueta): Promise<jsPDF> {
  const { qrAguardando, codigoAguardando, volumesAguardando } = await import("@/lib/toras-aguardando");
  const { largura: W, altura: H } = t;
  const o = W >= H ? "landscape" : "portrait";
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: [W, H], orientation: o, compress: true });
  const m = Math.max(2, Math.min(W, H) * 0.05);
  [...toras].sort((a, b) => a.numero - b.numero).forEach((tora, i) => {
    if (i > 0) doc.addPage([W, H], o);
    const qrMm = Math.min(H - 2 * m, W * 0.48);
    desenharQr(doc, qrAguardando(tora), m, (H - qrMm) / 2, qrMm);
    const x = m + qrMm + m;
    const com = volumesAguardando(tora)?.comercial;
    const linhas: [string, number, boolean][] = [
      [codigoAguardando(tora.numero), 1.8, true],
      ["Aguardando identificação", 0.8, false],
      [tora.especie, 1.2, true],
      ...(tora.nome_cientifico ? [[tora.nome_cientifico, 0.8, false] as [string, number, boolean]] : []),
      [`DF1×DF2: ${medida(tora.d_topo1)} × ${medida(tora.d_topo2)} cm`, 0.9, true],
      [`DF3×DF4: ${medida(tora.d_pe1)} × ${medida(tora.d_pe2)} cm`, 0.9, true],
      [`C.: ${medida(tora.comprimento)} m · Físico: ${Number(tora.volume).toFixed(4)} m³`, 0.9, true],
      [`Comercial: ${com ? `${com.d1}×${com.d2} cm · ${com.comprimento.toFixed(1)} m · ${com.volume.toFixed(4)} m³` : "—"}`, 0.9, true],
    ];
    const hTot = H - 2 * m;
    const soma = linhas.reduce((s, l) => s + l[1], 0);
    let y = m;
    for (const [s, peso, bold] of linhas) {
      const slot = (hTot * peso) / soma;
      textoEtiqueta(doc, s, x, y + slot * 0.05, W - x - m, (slot / 1.15) / 0.3528, bold);
      y += slot;
    }
  });
  return doc;
}

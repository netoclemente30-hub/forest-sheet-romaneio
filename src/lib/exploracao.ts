import type { Arvore } from "@/lib/data";

export type Coordenada = { lat: number; lng: number; precisao?: number | null; capturado_em?: string };
export type PontoRastro = {
  id: string;
  empresa_id: string;
  autex: string;
  sessao_id: string;
  lat: number;
  lng: number;
  precisao: number | null;
  capturado_em: string;
  user_id: string | null;
};

export function coordenadaValida(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function distanciaMetros(a: Pick<Coordenada, "lat" | "lng">, b: Pick<Coordenada, "lat" | "lng">): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function comprimentoRastro(pontos: Pick<Coordenada, "lat" | "lng">[]): number {
  return pontos.slice(1).reduce((total, ponto, i) => total + distanciaMetros(pontos[i]!, ponto), 0);
}

/** Evita encher o aparelho com pontos parados ou leituras claramente imprecisas. */
export function aceitarPontoRastro(anterior: Coordenada | undefined, novo: Coordenada): boolean {
  if (!coordenadaValida(novo.lat, novo.lng)) return false;
  if (novo.precisao != null && (!Number.isFinite(novo.precisao) || novo.precisao < 0 || novo.precisao > 100)) return false;
  if (!anterior) return true;
  const segundos = novo.capturado_em && anterior.capturado_em
    ? (new Date(novo.capturado_em).getTime() - new Date(anterior.capturado_em).getTime()) / 1000
    : 0;
  return distanciaMetros(anterior, novo) >= 3 || segundos >= 30;
}

export function mesclarRastros<T extends { id: string; capturado_em: string }>(...listas: T[][]): T[] {
  const unicos = new Map<string, T>();
  for (const lista of listas) for (const ponto of lista) unicos.set(ponto.id, ponto);
  return [...unicos.values()].sort((a, b) => a.capturado_em.localeCompare(b.capturado_em));
}

export type PontoMapa = { id: string; lat: number; lng: number };
export type ProjecaoMapa<T extends PontoMapa> = { ponto: T; x: number; y: number };

/** Projeção local em metros, adequada ao tamanho de um manejo e sem depender de internet. */
export function projetarMapa<T extends PontoMapa>(pontos: T[], largura = 640, altura = 420, margem = 34): ProjecaoMapa<T>[] {
  if (!pontos.length) return [];
  const lat0 = pontos.reduce((s, p) => s + p.lat, 0) / pontos.length;
  const metros = pontos.map((ponto) => ({
    ponto,
    mx: distanciaMetros({ lat: lat0, lng: 0 }, { lat: lat0, lng: ponto.lng }) * Math.sign(ponto.lng),
    my: distanciaMetros({ lat: 0, lng: 0 }, { lat: ponto.lat, lng: 0 }) * Math.sign(ponto.lat),
  }));
  const xs = metros.map((p) => p.mx);
  const ys = metros.map((p) => p.my);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const escala = Math.min(
    (largura - margem * 2) / Math.max(maxX - minX, 10),
    (altura - margem * 2) / Math.max(maxY - minY, 10),
  );
  const centroX = (minX + maxX) / 2;
  const centroY = (minY + maxY) / 2;
  return metros.map(({ ponto, mx, my }) => ({
    ponto,
    x: largura / 2 + (mx - centroX) * escala,
    y: altura / 2 - (my - centroY) * escala,
  }));
}

export function pontoDaArvore(a: Arvore): PontoMapa & { arvore: Arvore } | null {
  if (a.latitude == null || a.longitude == null || !coordenadaValida(Number(a.latitude), Number(a.longitude))) return null;
  return { id: a.id, lat: Number(a.latitude), lng: Number(a.longitude), arvore: a };
}

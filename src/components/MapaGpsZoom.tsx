import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { Crosshair, Minus, Plus, RotateCcw } from "lucide-react";
import type { Arvore } from "@/lib/data";
import { ALTURA_MAPA, LARGURA_MAPA, centroMapa, janelaMapa, limitarZoom } from "@/lib/mapa-campo";
import { Button } from "@/components/ui/button";

type PontoArvore = { arvore: Arvore; x: number; y: number };
type PontoXY = { x: number; y: number };
type Ponteiro = PontoXY & { clientX: number; clientY: number };

export function MapaGpsZoom({
  autex, arvores, percursos, atual, aoSelecionar, telaCheia = false,
}: {
  autex: string;
  arvores: PontoArvore[];
  percursos: string[];
  atual: PontoXY | null;
  aoSelecionar: (arvore: Arvore) => void;
  telaCheia?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [centro, setCentro] = useState({ x: LARGURA_MAPA / 2, y: ALTURA_MAPA / 2 });
  const svg = useRef<SVGSVGElement>(null);
  const dedos = useRef(new Map<number, Ponteiro>());
  const distanciaPinch = useRef<number | null>(null);
  const arrastou = useRef(false);

  useEffect(() => {
    setCentro((c) => centroMapa(c.x, c.y, zoom));
  }, [zoom]);

  const caixa = janelaMapa(centro.x, centro.y, zoom);
  function mudarZoom(proximo: number) {
    const z = limitarZoom(proximo);
    setZoom(z);
    setCentro((c) => centroMapa(c.x, c.y, z));
  }
  function centralizar() {
    if (!atual) return;
    setCentro(centroMapa(atual.x, atual.y, zoom));
  }
  function resetar() {
    setZoom(1);
    setCentro({ x: LARGURA_MAPA / 2, y: ALTURA_MAPA / 2 });
  }
  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (!e.isPrimary && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dedos.current.set(e.pointerId, {
      x: e.clientX, y: e.clientY, clientX: e.clientX, clientY: e.clientY,
    });
    if (dedos.current.size === 2) {
      const [a, b] = [...dedos.current.values()];
      if (a && b) distanciaPinch.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }
  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const anterior = dedos.current.get(e.pointerId);
    if (!anterior) return;
    dedos.current.set(e.pointerId, { ...anterior, x: e.clientX, y: e.clientY });
    const posicoes = [...dedos.current.values()];
    if (posicoes.length >= 2) {
      const [a, b] = posicoes;
      if (!a || !b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (distanciaPinch.current && dist > 0) {
        const fator = dist / distanciaPinch.current;
        if (Math.abs(fator - 1) > 0.005) {
          setZoom((z) => limitarZoom(z * fator));
          arrastou.current = true;
        }
      }
      distanciaPinch.current = dist;
      return;
    }
    const dx = e.clientX - anterior.x;
    const dy = e.clientY - anterior.y;
    if (Math.abs(e.clientX - anterior.clientX) + Math.abs(e.clientY - anterior.clientY) > 6)
      arrastou.current = true;
    const limites = svg.current?.getBoundingClientRect();
    if (!limites || limites.width <= 0 || limites.height <= 0) return;
    setCentro((c) => centroMapa(
      c.x - dx * (LARGURA_MAPA / zoom) / limites.width,
      c.y - dy * (ALTURA_MAPA / zoom) / limites.height, zoom,
    ));
  }
  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    dedos.current.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    distanciaPinch.current = null;
    if (!dedos.current.size && arrastou.current)
      setTimeout(() => { arrastou.current = false; }, 100);
  }
  function onWheel(e: ReactWheelEvent<SVGSVGElement>) {
    e.preventDefault();
    mudarZoom(zoom * (e.deltaY < 0 ? 1.25 : 0.8));
  }

  return (
    <section aria-label={"Mapa GPS interativo da AUTEX " + autex}
      className={"relative flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card " +
        (telaCheia ? "h-full flex-1" : "h-[360px] sm:h-[440px]")}>
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg border bg-card/95 p-1 shadow-sm">
        <Button size="icon" variant="outline" aria-label="Diminuir zoom do mapa" disabled={zoom <= 1}
          onClick={() => mudarZoom(zoom / 1.5)}><Minus className="size-4" /></Button>
        <span role="status" aria-label="Zoom atual" className="min-w-10 text-center text-xs font-semibold">
          {zoom.toFixed(1)}×
        </span>
        <Button size="icon" variant="outline" aria-label="Aumentar zoom do mapa" disabled={zoom >= 12}
          onClick={() => mudarZoom(zoom * 1.5)}><Plus className="size-4" /></Button>
        <Button size="icon" variant="outline" aria-label="Centralizar minha posição no mapa"
          disabled={!atual} onClick={centralizar}><Crosshair className="size-4" /></Button>
        <Button size="icon" variant="ghost" aria-label="Restaurar visualização do mapa"
          onClick={resetar}><RotateCcw className="size-4" /></Button>
      </div>
      <svg ref={svg} viewBox={caixa.join(" ")} preserveAspectRatio="xMidYMid meet"
        className="min-h-0 w-full flex-1 select-none touch-none"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onWheel={onWheel}
        role="img" aria-label={"Mapa exploratório da AUTEX " + autex}>
        <rect width={LARGURA_MAPA} height={ALTURA_MAPA} fill="var(--color-muted)" />
        {[80, 160, 240, 320, 400, 480, 560].map((x) =>
          <line key={x} x1={x} y1="0" x2={x} y2="420" stroke="var(--color-border)" strokeWidth="1" />)}
        {[70, 140, 210, 280, 350].map((y) =>
          <line key={y} x1="0" y1={y} x2="640" y2={y} stroke="var(--color-border)" strokeWidth="1" />)}
        {percursos.map((pontos, i) =>
          <polyline key={i} points={pontos} fill="none" stroke="var(--color-accent)" strokeWidth="5"
            strokeLinecap="round" strokeLinejoin="round" />)}
        {arvores.map(({ arvore, x, y }) =>
          <g key={arvore.id} role="button" tabIndex={0}
            aria-label={"Árvore " + arvore.numero + ", " + arvore.nome_vulgar +
              (arvore.abatida_em ? ", abatida" : "")}
            className="cursor-pointer"
            onClick={() => { if (!arrastou.current) aoSelecionar(arvore); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault(); aoSelecionar(arvore);
              }
            }}>
            <circle cx={x} cy={y} r={12 / Math.sqrt(zoom)}
              fill={arvore.abatida_em ? "var(--color-destructive)" :
                arvore.nao_abatida_motivo ? "var(--color-muted-foreground)" : "var(--color-primary)"}
              stroke="var(--color-card)" strokeWidth="3" />
            <text x={x + 15 / Math.sqrt(zoom)} y={y + 4 / Math.sqrt(zoom)}
              fontSize={12 / Math.sqrt(zoom)} fontWeight="700" fill="var(--color-foreground)">
              {arvore.numero}
            </text>
          </g>)}
        {atual && <g aria-label="Sua posição GPS">
          <circle cx={atual.x} cy={atual.y} r={11 / Math.sqrt(zoom)}
            fill="var(--color-gps)" stroke="var(--color-card)" strokeWidth="4" />
        </g>}
        {!arvores.length && !percursos.length && !atual &&
          <text x="320" y="205" textAnchor="middle" fontSize="16"
            fill="var(--color-muted-foreground)">Aguardando coordenadas e GPS</text>}
        <text x="608" y="36" textAnchor="middle" fontSize="24"
          fontWeight="700" fill="var(--color-foreground)">N</text>
        <path d="M608 44 L598 68 L608 62 L618 68 Z" fill="var(--color-foreground)" />
      </svg>
      <p className="border-t bg-card px-3 py-1.5 text-center text-xs text-muted-foreground">
        Toque em uma árvore · arraste para mover · pinça ou +/− para zoom
      </p>
    </section>
  );
}

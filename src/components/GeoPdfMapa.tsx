import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crosshair, LoaderCircle, Map as MapIcon, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { baixarMapaPdf, mapaPdfQuery } from "@/lib/mapa-pdf";
import { conversorMapa, renderizarGeoPdf, type MapaRenderizado } from "@/lib/geopdf";
import type { Coordenada, PontoRastro } from "@/lib/exploracao";
import type { Arvore } from "@/lib/data";

export function GeoPdfMapa({ autex, arvores, atual, rastros, encerrado, onArvore }: {
  autex: string; arvores: Arvore[]; atual: Coordenada | null; rastros: PontoRastro[]; encerrado: boolean;
  onArvore: (arvore: Arvore, posicao?: Coordenada) => void;
}) {
  const consulta = useQuery({ ...mapaPdfQuery(autex), enabled: !!autex });
  const arquivo = consulta.data?.[0];
  const [mapa, setMapa] = useState<MapaRenderizado | null>(null);
  const [converter, setConverter] = useState<Awaited<ReturnType<typeof conversorMapa>> | null>(null);
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [vincular, setVincular] = useState("");
  const [busca, setBusca] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const versao = useRef(0);
  useEffect(() => { versao.current++; setMapa(null); setConverter(null); setErro(""); setBusy(false); }, [arquivo?.id, arquivo?.atualizado_em]);
  async function carregar() {
    if (!arquivo || busy) return;
    const token = ++versao.current;
    setBusy(true); setErro("");
    try {
      const pdf = await baixarMapaPdf(arquivo);
      const resultado = await renderizarGeoPdf(new Uint8Array(await pdf.blob.arrayBuffer()));
      const transform = await conversorMapa(resultado);
      if (token !== versao.current) return;
      setMapa(resultado); setConverter(transform); setZoom(1);
    } catch (e) { if (token === versao.current) setErro(e instanceof Error ? e.message : "Não foi possível ler o GeoPDF"); }
    finally { if (token === versao.current) setBusy(false); }
  }
  if (!arquivo) return null;
  const pontos = mapa && converter ? arvores.flatMap((a) => {
    if (a.latitude == null || a.longitude == null) return [];
    const [x, y] = converter.tela({ lat: Number(a.latitude), lng: Number(a.longitude) });
    return x >= 0 && y >= 0 && x <= mapa.largura && y <= mapa.altura ? [{ a, x, y }] : [];
  }) : [];
  const posicao = atual && converter ? converter.tela(atual) : null;
  const noMapa = !!(posicao && mapa && posicao[0] >= 0 && posicao[1] >= 0 && posicao[0] <= mapa.largura && posicao[1] <= mapa.altura);
  const percursos = new Map<string, string[]>();
  if (converter) for (const p of rastros) {
    const grupo = p.sessao_id ?? "antigo";
    const [x, y] = converter.tela(p);
    percursos.set(grupo, [...(percursos.get(grupo) ?? []), `${x},${y}`]);
  }
  function centralizar() {
    if (!posicao || !mapa || !container.current || !svg.current) return;
    const escala = svg.current.getBoundingClientRect().width / mapa.largura;
    container.current.scrollTo({ left: posicao[0] * escala - container.current.clientWidth / 2, top: posicao[1] * escala - container.current.clientHeight / 2, behavior: "smooth" });
  }
  return <section className="space-y-3" aria-label="Leitor GeoPDF">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold">Mapa GeoPDF</h2>
      <Button variant="outline" size="sm" onClick={carregar} disabled={busy}><MapIcon />{busy ? "Lendo mapa…" : mapa ? "Recarregar mapa" : "Ler GeoPDF"}</Button>
    </div>
    {busy && <div role="status" className="flex items-center gap-2 text-sm"><LoaderCircle className="size-4 animate-spin" />Preparando mapa e coordenadas…</div>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {mapa && converter && <>
      <div className="flex items-center gap-2">
        <Button size="icon" variant="outline" aria-label="Diminuir mapa" title="Diminuir mapa" disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z - 1))}><Minus /></Button>
        <span className="text-sm">{zoom}×</span>
        <Button size="icon" variant="outline" aria-label="Ampliar mapa" title="Ampliar mapa" disabled={zoom >= 12} onClick={() => setZoom((z) => Math.min(12, z + 1))}><Plus /></Button>
        <Button size="icon" variant="outline" aria-label="Centralizar minha posição" title="Centralizar minha posição" disabled={!noMapa} onClick={centralizar}><Crosshair /></Button>
        <span className="ml-auto text-xs text-muted-foreground">Página {mapa.geo.pagina}</span>
      </div>
      <div ref={container} className="h-[440px] overflow-auto border bg-background sm:h-[560px]">
        <svg ref={svg} viewBox={`0 0 ${mapa.largura} ${mapa.altura}`} width={`${zoom * 100}%`} className="block max-w-none" role="img" aria-label={`Planta georreferenciada da AUTEX ${autex}`} onClick={(e) => {
          const a = arvores.find((a) => a.id === vincular);
          const matrix = svg.current?.getScreenCTM();
          if (!a || !matrix || encerrado) return;
          const ponto = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
          onArvore(a, converter.gps(ponto.x, ponto.y));
          setVincular("");
        }}>
          <image href={mapa.imagem} width={mapa.largura} height={mapa.altura} />
          {[...percursos].map(([id, pontos]) => <polyline key={id} points={pontos.join(" ")} fill="none" stroke="var(--color-accent)" strokeWidth="3" vectorEffect="non-scaling-stroke" />)}
          {pontos.map(({ a, x, y }) => <g key={a.id} role="button" tabIndex={0} aria-label={`Árvore ${a.numero} no GeoPDF`} onClick={(e) => { e.stopPropagation(); onArvore(a); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onArvore(a); } }} className="cursor-pointer">
            <circle cx={x} cy={y} r={mapa.largura / 180 / zoom} fill={a.abatida_em ? "var(--color-destructive)" : "var(--color-primary)"} stroke="var(--color-card)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <text x={x + mapa.largura / 160 / zoom} y={y} fontSize={mapa.largura / 80 / zoom} fill="var(--color-foreground)" stroke="var(--color-card)" strokeWidth="2" paintOrder="stroke">{a.numero}</text>
          </g>)}
          {noMapa && posicao && <circle aria-label="Minha posição no GeoPDF" cx={posicao[0]} cy={posicao[1]} r={mapa.largura / 120 / zoom} fill="var(--color-accent)" stroke="var(--color-primary)" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
        </svg>
      </div>
      <p role="status" className="text-xs text-muted-foreground">{atual ? noMapa ? "Sua posição está dentro da planta." : "Sua posição está fora desta planta." : "Inicie o GPS para mostrar sua posição."} · Mapa preparado neste aparelho.</p>
      {!encerrado && <div className="space-y-2">
        <h3 className="text-sm font-semibold">Vincular árvore ao ponto do mapa</h3>
        <input type="search" aria-label="Buscar árvore para vincular no mapa" placeholder="Número ou espécie" value={busca} onChange={(e) => setBusca(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
        <select aria-label="Árvore para vincular no GeoPDF" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={vincular} onChange={(e) => setVincular(e.target.value)}>
          <option value="">Selecionar árvore</option>
          {arvores.filter((a) => `${a.numero} ${a.nome_vulgar}`.toLocaleLowerCase().includes(busca.toLocaleLowerCase())).map((a) => <option key={a.id} value={a.id}>{a.numero} · {a.nome_vulgar}{a.latitude != null ? " · localizada" : ""}</option>)}
        </select>
        {vincular && <p className="text-sm text-primary">Toque no símbolo da árvore na planta e confira o número antes de salvar.</p>}
      </div>}
    </>}
  </section>;
}
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Estado, Camada, Projeto } from "@/lib/engenheiro/projeto";
import { avaliarCenso, areaHa, bufferApp, ehAppAutomatica, DISTANCIAS_APP } from "@/lib/engenheiro/camadas";
import { paraGpx, lerGpx, type PontoTrilha } from "@/lib/engenheiro/gps";
import { abrirMbtiles, type Mbtiles } from "@/lib/engenheiro/mbtiles";
import { salvarArquivo } from "@/lib/arquivo";
import { area as turfArea } from "@turf/turf";
import { paraUTM, distanciaMetros, gradeUTM, type Coordenada } from "@/lib/engenheiro/gis";
import { Button } from "@/components/ui/button";
import { gerarBufferAPP, exportarGPX, importarGPX, hectares } from "@/lib/engenheiro/camadas";
import { salvarArquivo } from "@/lib/arquivo";

export function MapaLocal({
  s,
  p,
  ut,
  onSalvar,
  onCamadas,
}: {
  s: Estado;
  p: Projeto;
  ut: string;
  onSalvar: (c: Camada) => Promise<void>;
  onCamadas: (camadas: Camada[]) => Promise<void>;
}) {
  const el = useRef<HTMLDivElement>(null),
    mapa = useRef<Leaflet.Map | null>(null);
  const [modo, setModo] = useState("consultar"),
    [raio, setRaio] = useState(250),
    [pontos, setPontos] = useState<Coordenada[]>([]),
    [cursor, setCursor] = useState(""),
    [erro, setErro] = useState("");
  const [tipoGrade, setTipoGrade] = useState("geografica");
<<<<<<< HEAD
  const [gravandoGPS, setGravandoGPS] = useState(false),
    [distAPP, setDistAPP] = useState<30 | 50 | 100>(30);
  const gps = useRef<number | null>(null);
  const trilha = useRef<Coordenada[]>([]);
  const importarTrilha = async (file: File) => {
    const fc = importarGPX(await file.text());
    await onSalvar({
      id: crypto.randomUUID(),
      projetoId: p.id,
      tipo: "Patios_Estradas",
      ut,
      geojson: fc,
    });
  };
=======
  const [versao, setVersao] = useState(0),
    [destino, setDestino] = useState<"Limite_UPA" | "UTs" | "APP">("Limite_UPA"),
    [editando, setEditando] = useState(""),
    [metrosApp, setMetrosApp] = useState<number>(30),
    [fundo, setFundo] = useState<
      | { tipo: "mbtiles"; mb: Mbtiles }
      | { tipo: "imagem"; url: string; bounds: [[number, number], [number, number]]; nome: string }
      | null
    >(null),
    [limitesImg, setLimitesImg] = useState({ n: "", s: "", l: "", o: "" }),
    [trilha, setTrilha] = useState<PontoTrilha[]>([]),
    [gravando, setGravando] = useState(false),
    [aviso, setAviso] = useState("");
  const watchId = useRef<number | null>(null);
>>>>>>> 8a014b752aa100f7229f54256af8852f7952f1ac
  const modoRef = useRef(modo);
  modoRef.current = modo;
  useEffect(() => {
    let cancelado = false;
    let instance: Leaflet.Map | null = null;
    void import("leaflet").then((L) => {
      if (cancelado || !el.current) return;
      const m = L.map(el.current).setView([-10, -63], 8);
      instance = m;
      mapa.current = m;
      setVersao((v) => v + 1);
      L.control.scale({ imperial: false }).addTo(m);
      const grupo = L.featureGroup().addTo(m);
      s.camadas
        .filter((c) => c.projetoId === p.id)
        .forEach((c) =>
          L.geoJSON(c.geojson, {
            style: {
              color: c.tipo === "APP" ? "#dc2626" : c.tipo === "Hidrografia" ? "#0284c7" : "#64748b",
              weight: 2,
              fillOpacity: c.tipo === "APP" ? 0.2 : 0.05,
            },
            pointToLayer: (f, ll) =>
              L.circle(ll, { radius: Number(f.properties?.["raioM"]) || 5, color: "#9333ea" }),
          }).addTo(grupo),
        );
      const cores = {
        CORTE: "#16a34a",
        PORTA_SEMENTE: "#2563eb",
        REMANESCENTE: "#ca8a04",
        PROIBIDA_APP: "#dc2626",
      };
      avaliarCenso(s, p.id)
        .filter((a) => !ut || a.ut === ut)
        .forEach((a) => {
          const label = document.createElement("span");
          label.textContent = `${a.numeroArvore} · ${a.destinacao}`;
          L.circleMarker([a.latitude, a.longitude], {
            radius: 6,
            color: cores[a.destinacao],
            fillOpacity: 0.8,
          })
            .bindTooltip(label)
            .addTo(grupo);
        });
      if (grupo.getLayers().length)
        m.fitBounds(grupo.getBounds(), { maxZoom: 17, padding: [20, 20] });
      const grade = L.layerGroup().addTo(m);
      const desenhar = () => {
        grade.clearLayers();
        const b = m.getBounds(),
          passo = 10 ** Math.floor(Math.log10(Math.max(b.getNorth() - b.getSouth(), 0.0001) / 4));
        if (tipoGrade === "utm") {
          try {
            for (const linha of gradeUTM(
              b.getSouth(),
              b.getWest(),
              b.getNorth(),
              b.getEast(),
              p.zona,
              p.hemisferio,
            )) {
              L.polyline(
                linha.pontos.map((c) => [c.latitude, c.longitude] as [number, number]),
                { color: "#64748b", weight: 1, opacity: 0.6 },
              )
                .bindTooltip(linha.rotulo, { sticky: true })
                .addTo(grade);
            }
          } catch {
            /* View may extend beyond the configured UTM hemisphere. */
          }
          return;
        }
        let n = 0;
        for (
          let lat = Math.ceil(b.getSouth() / passo) * passo;
          lat < b.getNorth() && n < 100;
          lat += passo, n++
        )
          L.polyline(
            [
              [lat, b.getWest()],
              [lat, b.getEast()],
            ],
            { color: "#94a3b8", weight: 1, opacity: 0.4, interactive: false },
          ).addTo(grade);
        for (
          let lon = Math.ceil(b.getWest() / passo) * passo;
          lon < b.getEast() && n < 200;
          lon += passo, n++
        )
          L.polyline(
            [
              [b.getSouth(), lon],
              [b.getNorth(), lon],
            ],
            { color: "#94a3b8", weight: 1, opacity: 0.4, interactive: false },
          ).addTo(grade);
      };
      m.on("moveend", desenhar);
      desenhar();
      m.on("mousemove", (e) => {
        try {
          const u = paraUTM(
            { latitude: e.latlng.lat, longitude: e.latlng.lng },
            p.zona,
            p.hemisferio,
          );
          setCursor(
            `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)} · UTM ${p.zona}${p.hemisferio}: ${u.x.toFixed(1)} / ${u.y.toFixed(1)} m`,
          );
        } catch {
          setCursor("Fora do hemisfério configurado");
        }
      });
      m.on("click", (e) => {
        if (modoRef.current !== "consultar")
          setPontos((a) =>
            modoRef.current === "patio" || modoRef.current === "nascente"
              ? [{ latitude: e.latlng.lat, longitude: e.latlng.lng }]
              : [...a, { latitude: e.latlng.lat, longitude: e.latlng.lng }],
          );
      });
    });
    return () => {
      cancelado = true;
      instance?.remove();
      mapa.current = null;
    };
  }, [s, p, ut, tipoGrade]);
  useEffect(() => {
    let camada: Leaflet.LayerGroup | undefined;
    let cancelado = false;
    void import("leaflet").then((L) => {
      if (cancelado || !mapa.current) return;
      camada = L.layerGroup().addTo(mapa.current);
      const pts = pontos.map((a) => [a.latitude, a.longitude] as [number, number]);
      if (modo === "patio" && pts[0])
        L.circle(pts[0], { radius: raio, color: "#9333ea" }).addTo(camada);
      else if (modo === "poligono" && pts.length > 2)
        L.polygon(pts, { color: "#9333ea", fillOpacity: 0.15 }).addTo(camada);
      else if (pts.length > 1) L.polyline(pts, { color: modo === "hidro" ? "#0284c7" : "#9333ea" }).addTo(camada);
      // Draggable vertices: edit the drawing in place.
      if (modo !== "consultar")
        pts.forEach((pt, i) => {
          const mk = L.circleMarker(pt, { radius: 6, color: "#9333ea", fillOpacity: 1 }).addTo(camada!);
          mk.on("mousedown", (ev) => {
            const m = mapa.current!;
            L.DomEvent.stopPropagation(ev);
            m.dragging.disable();
            const mover = (e: Leaflet.LeafletMouseEvent) => mk.setLatLng(e.latlng);
            m.on("mousemove", mover);
            m.once("mouseup", (e) => {
              m.off("mousemove", mover);
              m.dragging.enable();
              setPontos((a) => a.map((x, j) => (j === i ? { latitude: e.latlng.lat, longitude: e.latlng.lng } : x)));
            });
          });
          mk.on("contextmenu", () => setPontos((a) => a.filter((_, j) => j !== i)));
        });
    });
    return () => {
      cancelado = true;
      camada?.remove();
    };
  }, [pontos, modo, raio, versao]);
  // Offline raster background (MBTiles or georeferenced PDF/image).
  useEffect(() => {
    let camada: Leaflet.Layer | undefined;
    let cancelado = false;
    if (!fundo) return;
    void import("leaflet").then((L) => {
      const m = mapa.current;
      if (cancelado || !m) return;
      if (fundo.tipo === "imagem") {
        camada = L.imageOverlay(fundo.url, fundo.bounds, { opacity: 0.85 }).addTo(m);
      } else {
        const mb = fundo.mb;
        const Grade = L.GridLayer.extend({
          createTile(c: Leaflet.Coords, done: Leaflet.DoneCallback) {
            const img = document.createElement("img");
            const dado = mb.tile(c.z, c.x, c.y);
            if (!dado) {
              setTimeout(() => done(undefined, img));
              return img;
            }
            const url = URL.createObjectURL(new Blob([dado.slice()], { type: mb.mime }));
            img.onload = () => {
              URL.revokeObjectURL(url);
              done(undefined, img);
            };
            img.onerror = () => done(new Error("tile"), img);
            img.src = url;
            return img;
          },
        }) as unknown as new (o: Leaflet.GridLayerOptions) => Leaflet.GridLayer;
        camada = new Grade({ minZoom: 0, maxZoom: 22, maxNativeZoom: mb.maxzoom, minNativeZoom: mb.minzoom }).addTo(m);
      }
      (camada as Leaflet.GridLayer).bringToBack?.();
    });
    return () => {
      cancelado = true;
      camada?.remove();
    };
  }, [fundo, versao]);
  // GPS track line.
  useEffect(() => {
    let camada: Leaflet.Layer | undefined;
    let cancelado = false;
    if (!trilha.length) return;
    void import("leaflet").then((L) => {
      if (cancelado || !mapa.current) return;
      const g = L.layerGroup().addTo(mapa.current);
      camada = g;
      const pts = trilha.map((t) => [t.latitude, t.longitude] as [number, number]);
      L.polyline(pts, { color: "#f97316", weight: 4 }).addTo(g);
      L.circleMarker(pts.at(-1)!, { radius: 7, color: "#2563eb", fillOpacity: 1 }).addTo(g);
    });
    return () => {
      cancelado = true;
      camada?.remove();
    };
  }, [trilha, versao]);
  useEffect(
    () => () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    },
    [],
  );
  const camadasProjeto = s.camadas.filter((c) => c.projetoId === p.id);
  const editaveis = camadasProjeto.filter(
    (c) =>
      c.geojson.features.length === 1 &&
      ["Polygon", "LineString", "Point"].includes(c.geojson.features[0]!.geometry.type),
  );
  const areaDesenho =
    modo === "poligono" && pontos.length > 2
      ? turfArea({
          type: "Polygon",
          coordinates: [[...pontos, pontos[0]!].map((a) => [a.longitude, a.latitude])],
        }) / 10000
      : 0;
  const emApp = (() => {
    try {
      return avaliarCenso(s, p.id).filter((a) => a.alertas.some((t) => t.includes("APP"))).length;
    } catch {
      return 0;
    }
  })();
  function carregarEdicao(id: string) {
    setEditando(id);
    const c = camadasProjeto.find((c) => c.id === id);
    if (!c) {
      setPontos([]);
      return;
    }
    const g = c.geojson.features[0]!.geometry;
    const pc = (x: number[]) => ({ latitude: x[1]!, longitude: x[0]! });
    if (g.type === "Polygon") {
      setModo("poligono");
      if (c.tipo !== "Hidrografia" && c.tipo !== "Patios_Estradas") setDestino(c.tipo);
      setPontos(g.coordinates[0]!.slice(0, -1).map(pc));
    } else if (g.type === "LineString") {
      setModo(c.tipo === "Hidrografia" ? "hidro" : "trilha");
      setPontos(g.coordinates.map(pc));
    } else if (g.type === "Point") {
      setModo(c.tipo === "Hidrografia" ? "nascente" : "patio");
      setPontos([pc(g.coordinates)]);
    }
  }
  async function salvarDesenho() {
    const ll = pontos.map((a) => [a.longitude, a.latitude]);
    const tipo: Camada["tipo"] =
      modo === "poligono" ? destino : modo === "hidro" || modo === "nascente" ? "Hidrografia" : "Patios_Estradas";
    if (tipo === "UTs" && !ut) throw new Error("Selecione a UT acima antes de salvar o polígono da UT.");
    const geometry =
      modo === "poligono"
        ? { type: "Polygon" as const, coordinates: [[...ll, ll[0]!]] }
        : modo === "patio" || modo === "nascente"
          ? { type: "Point" as const, coordinates: ll[0]! }
          : { type: "LineString" as const, coordinates: ll };
    const props: Record<string, unknown> = { tipo: modo };
    if (modo === "patio") props["raioM"] = raio;
    if (modo === "poligono") props["areaHa"] = areaDesenho;
    if (modo === "trilha" || modo === "hidro") props["comprimentoM"] = comprimento;
    const nova: Camada = {
      id: editando || crypto.randomUUID(),
      projetoId: p.id,
      tipo,
      ut: tipo === "UTs" ? ut : (camadasProjeto.find((c) => c.id === editando)?.ut ?? ut),
      geojson: { type: "FeatureCollection", features: [{ type: "Feature", properties: props, geometry }] },
    };
    if (editando) await onCamadas(s.camadas.map((c) => (c.id === editando ? nova : c)));
    else await onSalvar(nova);
    setPontos([]);
    setEditando("");
    setErro("");
  }
  async function gerarApp() {
    const geojson = bufferApp(s, p.id, metrosApp);
    await onCamadas([
      ...s.camadas.filter((c) => !(c.projetoId === p.id && ehAppAutomatica(c))),
      { id: crypto.randomUUID(), projetoId: p.id, tipo: "APP", ut: "", geojson },
    ]);
    setAviso(`APP de ${metrosApp} m gerada (${areaHa(geojson).toFixed(4)} ha). Árvores reavaliadas.`);
  }
  async function carregarFundo(file: File) {
    if (fundo?.tipo === "mbtiles") fundo.mb.fechar();
    if (fundo?.tipo === "imagem") URL.revokeObjectURL(fundo.url);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (/\.mbtiles$/i.test(file.name)) {
      const mb = await abrirMbtiles(bytes, file.name);
      setFundo({ tipo: "mbtiles", mb });
      if (mb.bounds && mapa.current)
        mapa.current.fitBounds([
          [mb.bounds[1], mb.bounds[0]],
          [mb.bounds[3], mb.bounds[2]],
        ]);
      setAviso(`Mapa offline "${mb.nome}" carregado (zoom ${mb.minzoom}–${mb.maxzoom}).`);
    } else if (/\.pdf$/i.test(file.name)) {
      const { renderizarGeoPdf, conversorMapa } = await import("@/lib/geopdf");
      const r = await renderizarGeoPdf(bytes);
      const conv = await conversorMapa(r);
      const cantos = [conv.gps(0, 0), conv.gps(r.largura, 0), conv.gps(0, r.altura), conv.gps(r.largura, r.altura)];
      const lats = cantos.map((c) => c.lat),
        lngs = cantos.map((c) => c.lng);
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ];
      setFundo({ tipo: "imagem", url: r.imagem, bounds, nome: file.name });
      mapa.current?.fitBounds(bounds);
      setAviso(`GeoPDF "${file.name}" carregado como fundo.`);
    } else if (/^image\//.test(file.type)) {
      const n = Number(limitesImg.n), so = Number(limitesImg.s), l = Number(limitesImg.l), o = Number(limitesImg.o);
      if (![n, so, l, o].every(Number.isFinite) || !limitesImg.n || n <= so || l <= o)
        throw new Error("Informe os limites Norte/Sul/Leste/Oeste (graus decimais WGS84) da imagem.");
      const bounds: [[number, number], [number, number]] = [[so, o], [n, l]];
      setFundo({ tipo: "imagem", url: URL.createObjectURL(file), bounds, nome: file.name });
      mapa.current?.fitBounds(bounds);
      setAviso(`Imagem "${file.name}" carregada como fundo.`);
    } else throw new Error("Use .mbtiles, GeoPDF (.pdf) ou imagem (.png/.jpg).");
  }
  function alternarGravacao() {
    if (gravando) {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setGravando(false);
      return;
    }
    if (!("geolocation" in navigator)) {
      setErro("GPS indisponível neste aparelho.");
      return;
    }
    setGravando(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const novo: PontoTrilha = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          ...(pos.coords.altitude !== null ? { altitude: pos.coords.altitude } : {}),
          tempo: new Date(pos.timestamp).toISOString(),
        };
        setTrilha((t) => {
          const ult = t.at(-1);
          return ult && distanciaMetros(ult, novo) < 2 ? t : [...t, novo];
        });
      },
      (e) => setErro(`GPS: ${e.message}`),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    );
  }
  const comprimentoTrilha = trilha.reduce(
    (n, t, i) => n + (i ? distanciaMetros(trilha[i - 1]!, t) : 0),
    0,
  );
  const comprimento = pontos.reduce(
    (n, p, i) => n + (i ? distanciaMetros(pontos[i - 1]!, p) : 0),
    0,
  );
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Mapa vetorial local, funciona sem internet; opcionalmente carregue um mapa de fundo offline. Grade geográfica ou UTM;
        leitura UTM na posição do cursor. Verde: corte · azul: sementes · amarelo: remanescentes ·
        vermelho: proibidas/APP.
      </p>
      <div className="flex flex-wrap gap-2">
        <label>
          Grade{" "}
          <select
            className="border rounded p-2"
            value={tipoGrade}
            onChange={(e) => setTipoGrade(e.target.value)}
          >
            <option value="geografica">Lat/Lon</option>
            <option value="utm">UTM do projeto</option>
          </select>
        </label>
        <label>
          Ferramenta{" "}
          <select
            className="border rounded p-2"
            value={modo}
            onChange={(e) => {
              setModo(e.target.value);
              setPontos([]);
            }}
          >
            <option value="consultar">Consultar</option>
            <option value="patio">Pátio</option>
            <option value="trilha">Estrada / trilha</option>
<<<<<<< HEAD
            <option value="poligono-UPA">Polígono UPA</option>
            <option value="poligono-UT">Polígono UT</option>
            <option value="hidrografia">Hidrografia / nascente</option>
=======
            <option value="poligono">Polígono (perímetro / UPA / UT)</option>
            <option value="hidro">Hidrografia (linha)</option>
            <option value="nascente">Nascente (ponto)</option>
          </select>
        </label>
        {modo === "poligono" && (
          <label>
            Salvar como{" "}
            <select
              className="border rounded p-2"
              value={destino}
              onChange={(e) => setDestino(e.target.value as typeof destino)}
            >
              <option value="Limite_UPA">Perímetro / Limite UPA</option>
              <option value="UTs">UT (selecione a UT acima)</option>
              <option value="APP">APP manual</option>
            </select>
          </label>
        )}
        <label>
          Editar camada{" "}
          <select
            className="border rounded p-2"
            value={editando}
            onChange={(e) => carregarEdicao(e.target.value)}
          >
            <option value="">Nova</option>
            {editaveis.map((c, i) => (
              <option key={c.id} value={c.id}>
                {i + 1}. {c.tipo} · {c.geojson.features[0]!.geometry.type}
              </option>
            ))}
>>>>>>> 8a014b752aa100f7229f54256af8852f7952f1ac
          </select>
        </label>
        <label>
          Raio de arraste (m){" "}
          <input
            className="border rounded p-2 w-24"
            type="number"
            min="1"
            value={raio}
            onChange={(e) => setRaio(Number(e.target.value))}
          />
        </label>
        <Button variant="outline" onClick={() => setPontos([])}>
          Limpar desenho
        </Button>
        {(modo === "poligono-UPA" || modo === "poligono-UT" || modo === "hidrografia") && (
          <Button
            onClick={() => {
              if (modo === "hidrografia" && pontos.length < 2) {
                setErro("Marque ao menos dois pontos.");
                return;
              }
              if (modo !== "hidrografia" && pontos.length < 3) {
                setErro("Polígono exige três pontos.");
                return;
              }
              const coords = pontos.map((a) => [a.longitude, a.latitude]);
              if (modo !== "hidrografia") coords.push(coords[0]!);
              const tipo =
                modo === "hidrografia"
                  ? "Hidrografia"
                  : modo === "poligono-UPA"
                    ? "Limite_UPA"
                    : "UTs";
              void onSalvar({
                id: crypto.randomUUID(),
                projetoId: p.id,
                tipo,
                ut,
                geojson: {
                  type: "FeatureCollection",
                  features: [
                    {
                      type: "Feature",
                      properties: {
                        areaHa:
                          modo === "hidrografia"
                            ? null
                            : hectares({
                                type: "FeatureCollection",
                                features: [
                                  {
                                    type: "Feature",
                                    properties: {},
                                    geometry: { type: "Polygon", coordinates: [coords] },
                                  },
                                ],
                              }).toFixed(3),
                      },
                      geometry:
                        modo === "hidrografia"
                          ? { type: "LineString", coordinates: coords }
                          : { type: "Polygon", coordinates: [coords] },
                    },
                  ],
                },
              })
                .then(() => setPontos([]))
                .catch((e) => setErro(e.message));
            }}
          >
            Salvar {modo}
          </Button>
        )}
        <label className="border rounded p-2">
          Buffer APP{" "}
          <select
            value={distAPP}
            onChange={(e) => setDistAPP(Number(e.target.value) as 30 | 50 | 100)}
          >
            <option value={30}>30 m</option>
            <option value={50}>50 m</option>
            <option value={100}>100 m</option>
          </select>
        </label>
        <Button
          onClick={() => {
            try {
              const fc = {
                type: "FeatureCollection" as const,
                features: s.camadas
                  .filter((c) => c.projetoId === p.id && c.tipo === "Hidrografia")
                  .flatMap((c) => c.geojson.features),
              };
              const geojson = gerarBufferAPP(fc, distAPP);
              void onSalvar({
                id: crypto.randomUUID(),
                projetoId: p.id,
                tipo: "APP",
                ut,
                geojson,
              }).catch((e) => setErro(e.message));
            } catch (e) {
              setErro(String((e as Error).message));
            }
          }}
        >
          Gerar buffer APP
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (gravandoGPS) {
              if (gps.current !== null) navigator.geolocation.clearWatch(gps.current);
              gps.current = null;
              setGravandoGPS(false);
              return;
            }
            if (!navigator.geolocation) {
              setErro("GPS não disponível.");
              return;
            }
            trilha.current = [];
            gps.current = navigator.geolocation.watchPosition(
              (pos) => {
                trilha.current.push({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                });
                setPontos([...trilha.current]);
              },
              (e) => setErro(e.message),
              { enableHighAccuracy: true, maximumAge: 0 },
            );
            setGravandoGPS(true);
          }}
        >
          {" "}
          {gravandoGPS ? "Parar GPS" : "Gravar trilha GPS"}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            salvarArquivo({
              nome: "trilha.gpx",
              blob: new Blob(
                [
                  exportarGPX({
                    type: "FeatureCollection",
                    features: [
                      {
                        type: "Feature",
                        properties: {},
                        geometry: {
                          type: "LineString",
                          coordinates: pontos.map((x) => [x.longitude, x.latitude]),
                        },
                      },
                    ],
                  }),
                ],
                { type: "application/gpx+xml" },
              ),
            })
          }
        >
          Exportar GPX
        </Button>
        <label>
          Importar GPX{" "}
          <input
            type="file"
            accept=".gpx,application/gpx+xml"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importarTrilha(f).catch((x) => setErro(x.message));
              e.target.value = "";
            }}
          />
        </label>
        <Button
          disabled={
            !pontos.length ||
            !Number.isFinite(raio) ||
            raio <= 0 ||
            ((modo === "trilha" || modo === "hidro") && pontos.length < 2) ||
            (modo === "poligono" && pontos.length < 3)
          }
          onClick={() => void salvarDesenho().catch((e) => setErro(String(e.message ?? e)))}
        >
          Salvar desenho
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2 rounded-lg border p-2">
        <label>
          Faixa de APP{" "}
          <select
            className="border rounded p-2"
            value={metrosApp}
            onChange={(e) => setMetrosApp(Number(e.target.value))}
          >
            {DISTANCIAS_APP.map((d) => (
              <option key={d} value={d}>
                {d} m
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" onClick={() => void gerarApp().catch((e) => setErro(String(e.message ?? e)))}>
          Gerar APP sobre hidrografia
        </Button>
        <span className="text-sm">{emApp} árvores em APP</span>
      </div>
      <div className="flex flex-wrap items-end gap-2 rounded-lg border p-2">
        <label className="text-sm">
          Mapa offline (.mbtiles, GeoPDF ou imagem){" "}
          <input
            type="file"
            accept=".mbtiles,.pdf,image/png,image/jpeg"
            className="block text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void carregarFundo(f).catch((x) => setErro(String(x.message ?? x)));
            }}
          />
        </label>
        {(["n", "s", "l", "o"] as const).map((k) => (
          <input
            key={k}
            className="border rounded p-2 w-24 text-sm"
            placeholder={{ n: "Norte", s: "Sul", l: "Leste", o: "Oeste" }[k]}
            inputMode="decimal"
            value={limitesImg[k]}
            onChange={(e) => setLimitesImg((v) => ({ ...v, [k]: e.target.value }))}
            aria-label={`Limite ${k} da imagem`}
          />
        ))}
        {fundo && (
          <Button variant="outline" onClick={() => setFundo(null)}>
            Remover fundo
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
        <Button variant={gravando ? "destructive" : "default"} onClick={alternarGravacao}>
          {gravando ? "Parar gravação" : "Gravar trilha GPS"}
        </Button>
        <Button
          variant="outline"
          disabled={!trilha.length}
          onClick={() =>
            void salvarArquivo({
              nome: `trilha-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.gpx`,
              blob: new Blob([paraGpx(trilha, p.nome)], { type: "application/gpx+xml" }),
            }).catch((e) => setErro(String(e.message ?? e)))
          }
        >
          Exportar .gpx
        </Button>
        <label className="text-sm">
          Importar .gpx{" "}
          <input
            type="file"
            accept=".gpx,application/gpx+xml"
            className="text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f)
                void f
                  .text()
                  .then((t) => {
                    const pts = lerGpx(t);
                    setTrilha(pts);
                    mapa.current?.fitBounds(pts.map((x) => [x.latitude, x.longitude] as [number, number]));
                  })
                  .catch((x) => setErro(String(x.message ?? x)));
            }}
          />
        </label>
        <Button
          variant="outline"
          disabled={trilha.length < 2}
          onClick={() => {
            setEditando("");
            setModo("trilha");
            setPontos(trilha.map((t) => ({ latitude: t.latitude, longitude: t.longitude })));
          }}
        >
          Usar como estrada/trilha
        </Button>
        {trilha.length > 0 && (
          <Button variant="ghost" disabled={gravando} onClick={() => setTrilha([])}>
            Limpar trilha
          </Button>
        )}
        <span className="text-sm">
          {trilha.length} pontos · {comprimentoTrilha.toFixed(0)} m{gravando ? " · gravando…" : ""}
        </span>
      </div>
      {erro && <p role="alert" className="text-destructive">{erro}</p>}
      {aviso && <p role="status" className="text-sm">{aviso}</p>}
      <p className="text-sm">
        {pontos.length} pontos · {comprimento.toFixed(1)} m
        {modo === "poligono" && pontos.length > 2 ? ` · ${areaDesenho.toFixed(4)} ha` : ""}. Clique no
        mapa para desenhar; arraste um vértice para editar; botão direito no vértice remove.
      </p>
      {camadasProjeto.some((c) => areaHa(c.geojson) > 0) && (
        <ul className="text-sm">
          {camadasProjeto
            .filter((c) => areaHa(c.geojson) > 0)
            .map((c) => (
              <li key={c.id}>
                {c.tipo}
                {c.ut ? ` (${s.uts.find((u) => u.id === c.ut)?.nome ?? c.ut})` : ""}:{" "}
                {areaHa(c.geojson).toFixed(4)} ha
              </li>
            ))}
        </ul>
      )}
      <div
        ref={el}
        className="h-[480px] rounded-xl border z-0"
        aria-label="Mapa offline do projeto"
      />
      <p className="text-xs" role="status">
        {cursor}
      </p>
    </div>
  );
}

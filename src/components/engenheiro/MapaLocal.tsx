import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Estado, Camada, Projeto } from "@/lib/engenheiro/projeto";
import { avaliarCenso } from "@/lib/engenheiro/camadas";
import { paraUTM, distanciaMetros, gradeUTM, type Coordenada } from "@/lib/engenheiro/gis";
import { Button } from "@/components/ui/button";

export function MapaLocal({
  s,
  p,
  ut,
  onSalvar,
}: {
  s: Estado;
  p: Projeto;
  ut: string;
  onSalvar: (c: Camada) => Promise<void>;
}) {
  const el = useRef<HTMLDivElement>(null),
    mapa = useRef<Leaflet.Map | null>(null);
  const [modo, setModo] = useState("consultar"),
    [raio, setRaio] = useState(250),
    [pontos, setPontos] = useState<Coordenada[]>([]),
    [cursor, setCursor] = useState(""),
    [erro, setErro] = useState("");
  const [tipoGrade, setTipoGrade] = useState("geografica");
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
      L.control.scale({ imperial: false }).addTo(m);
      const grupo = L.featureGroup().addTo(m);
      s.camadas
        .filter((c) => c.projetoId === p.id)
        .forEach((c) =>
          L.geoJSON(c.geojson, {
            style: { color: c.tipo === "APP" ? "#dc2626" : "#64748b", weight: 2 },
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
            modoRef.current === "patio"
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
      else if (pts.length) L.polyline(pts, { color: "#9333ea" }).addTo(camada);
    });
    return () => {
      cancelado = true;
      camada?.remove();
    };
  }, [pontos, modo, raio]);
  const comprimento = pontos.reduce(
    (n, p, i) => n + (i ? distanciaMetros(pontos[i - 1]!, p) : 0),
    0,
  );
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Mapa vetorial local, sem mapas-base ou downloads da internet. Grade geográfica ou UTM;
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
        <Button
          disabled={
            !pontos.length ||
            !Number.isFinite(raio) ||
            raio <= 0 ||
            (modo !== "patio" && pontos.length < 2)
          }
          onClick={() =>
            void onSalvar({
              id: crypto.randomUUID(),
              projetoId: p.id,
              tipo: "Patios_Estradas",
              ut,
              geojson: {
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    properties: {
                      tipo: modo,
                      raioM: modo === "patio" ? raio : null,
                      comprimentoM: comprimento,
                    },
                    geometry:
                      modo === "patio"
                        ? {
                            type: "Point",
                            coordinates: [pontos[0]!.longitude, pontos[0]!.latitude],
                          }
                        : {
                            type: "LineString",
                            coordinates: pontos.map((a) => [a.longitude, a.latitude]),
                          },
                  },
                ],
              },
            })
              .then(() => {
                setPontos([]);
                setErro("");
              })
              .catch((e) => setErro(String(e.message ?? e)))
          }
        >
          Salvar desenho
        </Button>
      </div>
      {erro && <p role="alert">{erro}</p>}
      <p className="text-sm">
        {pontos.length} pontos · {comprimento.toFixed(1)} m. Clique no mapa para desenhar.
      </p>
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

import type { Tora } from "@/lib/data";
import { qrTora } from "@/lib/tora-qr";
import { QrImage } from "./QrImage";

const medida = (n: number | null) => n === null ? "—" : Number(n).toFixed(2);

export function ToraLabel({ tora }: { tora: Tora }) {
  return <article className="tora-label" aria-label={`Etiqueta da tora ${tora.plaqueta}`}>
    <div className="label-top">
      <QrImage value={qrTora(tora)} size={150} />
      <div className="label-identidade">
        <div className="label-numeros">
          <div className="label-num"><span>Árvore</span><b>{tora.arvore}</b></div>
          <div className="label-num"><span>Secção</span><b>{tora.secao ?? "—"}</b></div>
        </div>
        <div className="label-plaqueta">Plaqueta {tora.plaqueta}</div>
        <div className="label-autex">Autorização: {tora.autex ?? "Não informada"}</div>
      </div>
    </div>
    <div className="label-especie">{tora.especie ?? "Não cadastrada"}{tora.nome_cientifico && <span> · {tora.nome_cientifico}</span>}</div>
    <div className="label-medidas">
      <div>{medida(tora.d_topo1)} × {medida(tora.d_topo2)} <small>DF1 × DF2 (cm)</small></div>
      <div>C.: {medida(tora.comprimento)} m</div>
      <div>{medida(tora.d_pe1)} × {medida(tora.d_pe2)} <small>DF3 × DF4 (cm)</small></div>
      <div>VOL.: {Number(tora.volume).toFixed(4)} m³</div>
    </div>
  </article>;
}
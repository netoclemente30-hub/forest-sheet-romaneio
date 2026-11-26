import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { consultarFichaSerrada, lerCopiaSerrada, type FichaSerrada } from "@/lib/rastreabilidade-serrada";
import { fmtM3 } from "@/lib/volume";

export const Route = createFileRoute("/t/serrada/$id")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Rastreabilidade da madeira · Gestor Florestal" }, { name: "robots", content: "noindex" }] }),
  component: ConsultaSerrada,
});

const dado = (v: string | number | null | undefined) => v == null || v === "" ? "Não informado" : String(v);
const data = (v: string | null) => {
  if (!v) return "Não informado";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split("-").reverse().join("/");
  const instante = new Date(v);
  return Number.isNaN(+instante) ? "Não informado" : instante.toLocaleDateString("pt-BR", { timeZone: "America/Porto_Velho" });
};

function ConsultaSerrada() {
  const { id } = Route.useParams();
  return <FichaPorCodigo key={id} id={id} />;
}

function FichaPorCodigo({ id }: { id: string }) {
  const [ficha, setFicha] = useState<FichaSerrada | null>(null);
  const [estado, setEstado] = useState("Consultando ficha…");
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const fim = setTimeout(() => controller.abort(), 12000);
    let ativa = true;
    setFicha(null);
    setEstado("Consultando ficha…");
    if (navigator.onLine === false) {
      const copia = lerCopiaSerrada(id);
      setFicha(copia?.ficha ?? null);
      setEstado(copia ? `Cópia offline consultada em ${new Date(copia.consultadaEm).toLocaleString("pt-BR")}` : "Sem conexão e sem cópia válida neste aparelho.");
    } else {
      void consultarFichaSerrada(id, controller.signal).then(resultado => {
        if (!ativa) return;
        setFicha(resultado);
        setEstado(resultado ? "" : "Ficha pública não encontrada.");
      }).catch(() => { if (ativa) setEstado("Consulta indisponível. Confira a conexão e tente novamente."); });
    }
    return () => { ativa = false; clearTimeout(fim); controller.abort(); };
  }, [id, tentativa]);

  return <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-8">
    <header><p className="text-sm font-semibold text-primary">Gestor Florestal</p><h1 className="text-2xl font-bold">Rastreabilidade da madeira</h1></header>
    {estado && <p role="status">{estado}</p>}
    {!ficha && <button className="underline" type="button" onClick={() => setTentativa(n => n + 1)}>Consultar novamente</button>}
    {ficha && <>
      <div className="rounded-lg border p-4">
        <h2 className="text-xl font-bold">{ficha.tipo === "carga" ? "Romaneio" : "Pacote"} {ficha.numero}</h2>
        <p>Emissor {dado(ficha.empresa?.razao_social)} · CNPJ {dado(ficha.empresa?.cnpj)}</p>
        <p>Data {data(ficha.data)} · Código verificador <span className="break-all font-mono">{id}</span></p>
      </div>
      {ficha.pacotes.map((p, index) => <section className="space-y-3 rounded-lg border p-4" key={index}>
        <h2 className="text-lg font-bold">Pacote {p.numero}</h2>
        <p>AUTEX/AUTESP {dado(p.autex)} · PMFS {dado(p.pmfs)} · POA {dado(p.poa)}</p>
        <p>Desdobro {data(p.data)} · CRV {p.crv_percentual == null ? dado(null) : `${p.crv_percentual}%`}</p>
        <ul className="divide-y">{p.itens.map((i, n) => <li className="py-2" key={n}>
          <strong>{i.especie}</strong> <i>{dado(i.nome_cientifico)}</i> · {i.tipo_peca} · {i.grossura} × {i.largura} cm · {i.total_pecas} peças · {fmtM3(Number(i.volume_m3))} m³
          <p className="text-sm">{Object.entries(i.distribuicao_pecas ?? {}).filter(([, qtd]) => qtd > 0).map(([c, qtd]) => `${qtd} × ${c.replace(".", ",")} m`).join(" · ")}</p>
        </li>)}</ul>
        <h3 className="font-semibold">Toras de origem</h3>
        {!p.toras.length && <p>Nenhuma tora de origem informada.</p>}
        <ul className="divide-y">{p.toras.map((t, n) => <li className="py-2 text-sm" key={n}>
          <p><strong>Plaqueta {t.plaqueta}</strong> · Árvore {t.arvore} · Secção {dado(t.secao)} · AUTEX/AUTESP {dado(t.autex)}</p>
          <p>{dado(t.especie)} · {dado(t.nome_cientifico)} · Talhão {dado(t.talhao)} · Coordenadas {t.latitude == null || t.longitude == null ? dado(null) : `${t.latitude}, ${t.longitude}`}</p>
          <p>Abate {data(t.abatida_em)} · Arraste {data(t.arrastada_em)} · Pátio {data(t.patio_em)}</p>
        </li>)}</ul>
      </section>)}
    </>}
  </main>;
}

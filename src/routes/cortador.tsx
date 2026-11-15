import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { arvoresQuery, autexQuery } from "@/lib/data";
import { MapaExploracao } from "@/components/MapaExploracao";
import { textoMotivo } from "@/lib/exploracao-salvar";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salvarArquivo } from "@/lib/arquivo";
import { modeloFichaCampo } from "@/lib/modelo-ficha-campo";
import { ImportarCoordenadas } from "@/components/ImportarCoordenadas";

export const Route = createFileRoute("/cortador")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Cortador / Mapa — Manejo Florestal" },
      { name: "description", content: "Mapa georreferenciado para o cortador abater árvores ou declarar o motivo de não abater." },
      { property: "og:title", content: "Cortador / Mapa — Manejo Florestal" },
      { property: "og:description", content: "Veja sua posição no mapa da exploração e registre árvores abatidas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CortadorPage,
});

function CortadorPage() {
  const autex = useQuery(autexQuery);
  const arvores = useQuery(arvoresQuery);
  const ativos = useMemo(() => (autex.data ?? []).filter((a) => !a.encerrado), [autex.data]);
  const [numero, setNumero] = useState("");
  useEffect(() => { if (!numero && ativos[0]) setNumero(ativos[0].numero); }, [ativos, numero]);
  const lista = useMemo(() => (arvores.data ?? []).filter((a) => a.autex === numero).sort((a, b) => a.numero - b.numero), [arvores.data, numero]);
  const naoAbatidas = lista.filter((a) => a.nao_abatida_motivo);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-bold">Cortador / Mapa</h1>
        <p className="text-sm text-muted-foreground">Importe o mapa georreferenciado (GeoPDF), veja sua posição em azul e toque no número da árvore para abater ou declarar por que não foi abatida.</p>
      </header>
      <select aria-label="Manejo (AUTEX)" value={numero} onChange={(e) => setNumero(e.target.value)} className="h-11 w-full rounded-md border bg-background px-3">
        {!ativos.length && <option value="">Nenhum manejo ativo — cadastre na Base</option>}
        {ativos.map((a) => <option key={a.numero} value={a.numero}>AUTEX {a.numero}{a.descricao ? ` · ${a.descricao}` : ""}</option>)}
      </select>
      {numero && <MapaExploracao key={numero} autex={numero} arvores={lista} encerrado={false} />}
      {naoAbatidas.length > 0 && <section className="rounded-xl border bg-card">
        <h2 className="border-b p-3 font-semibold">Não abatidas ({naoAbatidas.length})</h2>
        <div className="divide-y">{naoAbatidas.map((a) => <div key={a.id} className="flex justify-between gap-2 p-3 text-sm"><span>Árvore {a.numero} · {a.nome_vulgar}</span><span className="font-semibold text-destructive">{textoMotivo(a.nao_abatida_motivo)}</span></div>)}</div>
      </section>}
      <section className="flex flex-wrap items-center gap-2 border-t pt-4 pb-4">
        <Button variant="outline" className="h-auto min-h-11 max-w-full whitespace-normal text-left" onClick={() => salvarArquivo(modeloFichaCampo())}>
          <Download className="shrink-0" /> Baixar modelo de planilha — ficha de campo com coordenadas
        </Button>
        <ImportarCoordenadas autex={numero} arvores={lista} />
      </section>
    </div>
  );
}

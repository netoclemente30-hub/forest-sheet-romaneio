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
import { SinaflorCsvExportacao } from "@/components/SinaflorCsvExportacao";
import { useAuth } from "@/hooks/useAuth";
import { pode } from "@/lib/funcoes";
import { getEmpresaAtiva } from "@/lib/empresa";
import { empresaDaOperacao } from "@/lib/cadastros-empresa";

export const Route = createFileRoute("/cortador")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Mapa — Manejo Florestal" },
      { name: "description", content: "Mapa georreferenciado para o cortador abater árvores ou declarar o motivo de não abater." },
      { property: "og:title", content: "Mapa — Manejo Florestal" },
      { property: "og:description", content: "Veja sua posição no mapa da exploração e registre árvores abatidas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CortadorPage,
});

function CortadorPage() {
  const { papel, empresaId, isSuperAdmin } = useAuth();
  const empresa = empresaDaOperacao(isSuperAdmin, empresaId, getEmpresaAtiva());
  const autex = useQuery(autexQuery);
  const arvores = useQuery(arvoresQuery);
  const ativos = useMemo(() => (autex.data ?? []).filter((a) => !a.encerrado && a.empresa_id === empresa), [autex.data, empresa]);
  const [numero, setNumero] = useState("");
  useEffect(() => { if (!ativos.some((a) => a.numero === numero)) setNumero(ativos[0]?.numero ?? ""); }, [ativos, numero]);
  const numeroAtivo = ativos.some((a) => a.numero === numero) ? numero : ativos[0]?.numero ?? "";
  const lista = useMemo(() => (arvores.data ?? []).filter((a) => a.empresa_id === empresa && a.autex === numeroAtivo).sort((a, b) => a.numero - b.numero), [arvores.data, numeroAtivo, empresa]);
  const naoAbatidas = lista.filter((a) => a.nao_abatida_motivo);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-bold">Mapa</h1>
        <p className="text-sm text-muted-foreground">Veja árvores, coordenadas e posição GPS. Cada funcionário utiliza as ações autorizadas para seu cargo.</p>
      </header>
      {!empresa && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">Selecione uma empresa no topo antes de abrir o mapa de campo.</p>}
      <select aria-label="Manejo (AUTEX)" value={numeroAtivo} disabled={!empresa} onChange={(e) => setNumero(e.target.value)} className="h-11 w-full rounded-md border bg-background px-3">
        {!ativos.length && <option value="">Nenhum manejo ativo — cadastre na Base</option>}
        {ativos.map((a) => <option key={a.numero} value={a.numero}>AUTEX {a.numero}{a.descricao ? ` · ${a.descricao}` : ""}</option>)}
      </select>
      {empresa && numeroAtivo && <MapaExploracao key={empresa + ":" + numeroAtivo} autex={numeroAtivo} arvores={lista} encerrado={false} />}
      {empresa && numeroAtivo && (papel === "admin_empresa" || papel === "superadmin" || papel === "gerente_escritorio") && <SinaflorCsvExportacao arvores={lista} toras={[]} autexFixa={numeroAtivo} apenasAbatidas />}
      {naoAbatidas.length > 0 && <section className="rounded-xl border bg-card">
        <h2 className="border-b p-3 font-semibold">Não abatidas ({naoAbatidas.length})</h2>
        <div className="divide-y">{naoAbatidas.map((a) => <div key={a.id} className="flex justify-between gap-2 p-3 text-sm"><span>Árvore {a.numero} · {a.nome_vulgar}</span><span className="font-semibold text-destructive">{textoMotivo(a.nao_abatida_motivo)}</span></div>)}</div>
      </section>}
      {pode(papel, "base_importar") && <section className="flex flex-wrap items-center gap-2 border-t pt-4 pb-4">
        <Button variant="outline" className="h-auto min-h-11 max-w-full whitespace-normal text-left" onClick={() => salvarArquivo(modeloFichaCampo())}>
          <Download className="shrink-0" /> Baixar modelo de planilha — ficha de campo com coordenadas
        </Button>
        <ImportarCoordenadas autex={numeroAtivo} arvores={lista} />
      </section>}
    </div>
  );
}

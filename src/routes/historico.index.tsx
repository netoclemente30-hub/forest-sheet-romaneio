import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { romaneiosQuery } from "@/lib/data";
import { useFilaOffline } from "@/hooks/useFilaOffline";
import { useAuth } from "@/hooks/useAuth";
import { getEmpresaAtiva } from "@/lib/empresa";
import { romaneiosComFila } from "@/lib/tora-origem";
import { projetarDados } from "@/lib/offline/projecao";
import { fmtM3 } from "@/lib/volume";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/historico/")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Histórico de cargas — Manejo Florestal" },
      { name: "description", content: "Todos os romaneios de carga salvos." },
      { property: "og:title", content: "Histórico de cargas — Manejo Florestal" },
      { property: "og:description", content: "Todos os romaneios de carga salvos." },
    ],
  }),
  component: Historico,
});

function Historico() {
  const roms = useQuery(romaneiosQuery);
  const [q, setQ] = useState("");
  const { empresaId } = useAuth();
  const pendentes = useFilaOffline();
  const empresa = getEmpresaAtiva() ?? empresaId;
  const registros = romaneiosComFila(projetarDados('romaneios', roms.data ?? [], pendentes.itens, empresa), pendentes.itens, empresa);
  const lista = registros.filter((r) =>
    `${r.placa} ${r.motorista} ${r.julieta}`.toLowerCase().includes(q.toLowerCase()),
  );
  const total = lista.reduce((n, r) => n + Number(r.total_volume), 0);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold uppercase">Histórico de cargas</h1>
      <Input placeholder="Buscar placa ou motorista" value={q} onChange={(e) => setQ(e.target.value)} className="h-11" />
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{lista.length} cargas</span><span>{fmtM3(total)} m³</span>
      </div>
      <div className="space-y-2">
        {lista.map((r) => (
          <Link key={r.id} to="/historico/$id" params={{ id: r.id }} className="flex justify-between bg-card border rounded-lg p-3">
            <div>
              <div className="font-semibold">{r.placa || "Sem placa"}{pendentes.itens.some(i => i.op.tipo === 'romaneio_salvar' && i.op.empresa_id === empresa && (i.op.log?.operacao_id ?? i.id) === r.operacao_id) && <span className="ml-2 text-xs text-muted-foreground">Guardado neste aparelho · pendente de confirmação</span>}</div>
              <div className="text-xs text-muted-foreground">{new Date(r.data + "T12:00").toLocaleDateString("pt-BR")} · {r.motorista}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{fmtM3(Number(r.total_volume))} m³</div>
              <div className="text-xs text-muted-foreground">{r.qtd_toras} toras</div>
            </div>
          </Link>
        ))}
        {roms.isError && <p className="text-sm text-destructive">Não foi possível carregar as cargas. Confira a cópia offline e tente novamente.</p>}
        {!roms.isLoading && registros.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma carga disponível neste aparelho. Se existem cargas em outro aparelho, conecte e atualize a cópia offline.</p>}
      </div>
    </div>
  );
}

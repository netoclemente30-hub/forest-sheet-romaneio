import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Factory, Ruler, ShieldCheck, TreePine, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { medidaComercial, fmtComprimentoComercial } from "@/lib/medida-comercial";

export const Route = createFileRoute("/t/$id")({
  head: () => ({
    meta: [
      { title: "Rastreabilidade da tora · Gestor Florestal" },
      { name: "description", content: "Origem, medidas e situação de uma tora rastreada pelo Gestor Florestal." },
      { property: "og:title", content: "Rastreabilidade da tora · Gestor Florestal" },
      { property: "og:description", content: "Origem, medidas e situação de uma tora rastreada pelo Gestor Florestal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ToraPublica,
});

const n2 = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const m3 = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} m³`;
const data = (v: string | null | undefined) => (v ? new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString("pt-BR") : "");

function ToraPublica() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["tora-publica", id],
    queryFn: async () => {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const { data, error } = await supabase.rpc("tora_publica", { _id: id });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const t = q.data;
  return (
    <main className="min-h-screen bg-background pb-10">
      <header className="bg-forest px-4 py-5 text-primary-foreground">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <TreePine className="h-6 w-6" />
          <div><p className="font-display text-xl font-bold leading-none">Gestor Florestal</p><p className="text-xs opacity-80">Rastreabilidade de tora</p></div>
        </div>
      </header>
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        {q.isLoading && <p className="py-10 text-center text-muted-foreground">Carregando tora…</p>}
        {q.isError && <p className="rounded-lg border border-destructive p-4 text-destructive">Não foi possível consultar agora. Tente novamente em instantes.</p>}
        {!q.isLoading && !q.isError && !t && <p className="rounded-lg border p-6 text-center text-muted-foreground">Tora não encontrada. Confira o QR Code da etiqueta.</p>}
        {t && <Detalhes t={t} />}
        <p className="pt-2 text-center text-xs text-muted-foreground">Consulta pública gerada pelo <Link to="/apresentacao" className="underline">Gestor Florestal</Link>.</p>
      </div>
    </main>
  );
}

type Publica = Database["public"]["Functions"]["tora_publica"]["Returns"][number];

function Detalhes({ t }: { t: Publica }) {
  const c = medidaComercial(t);
  const status = t.serrada_em
    ? { icon: Factory, txt: "Serrada", det: `Processada na serraria em ${data(t.serrada_em)}` }
    : t.carregada
      ? { icon: Truck, txt: "Expedida", det: t.romaneio_data ? `Carregada em romaneio de ${data(t.romaneio_data)}` : "Carregada em romaneio" }
      : { icon: CheckCircle2, txt: "Em estoque", det: "No pátio, disponível" };
  const etapas = [
    { txt: "Medida e etiquetada", det: data(t.created_at), ok: true },
    { txt: "Expedida em romaneio", det: data(t.romaneio_data), ok: t.carregada || !!t.serrada_em },
    { txt: "Serrada", det: data(t.serrada_em), ok: !!t.serrada_em },
  ];
  return (
    <>
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Plaqueta</p>
        <p className="font-display text-5xl font-bold text-primary">{t.plaqueta}</p>
        <p className="mt-1 text-lg font-semibold">{t.especie ?? "Espécie não informada"}</p>
        {t.nome_cientifico && <p className="text-sm italic text-muted-foreground">{t.nome_cientifico}</p>}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Info rotulo="Árvore" valor={String(t.arvore)} />
          <Info rotulo="Seção" valor={t.secao || "—"} />
          <Info rotulo="AUTEX" valor={t.autex || "—"} pequeno />
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted p-3">
          <status.icon className="h-5 w-5 text-primary" />
          <div><p className="font-semibold">{status.txt}</p><p className="text-xs text-muted-foreground">{status.det}</p></div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><Ruler className="h-4 w-4" />Medida física</h2>
          <Linha k="Ponta fina (D1 × D2)" v={`${n2(t.d_topo1)} × ${n2(t.d_topo2)} cm`} />
          <Linha k="Ponta grossa (D3 × D4)" v={`${n2(t.d_pe1)} × ${n2(t.d_pe2)} cm`} />
          <Linha k="Comprimento" v={`${n2(t.comprimento)} m`} />
          <Linha k="Volume" v={m3(Number(t.volume))} forte />
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><Ruler className="h-4 w-4" />Medida comercial</h2>
          {c ? <>
            <Linha k="Diâmetros (ponta menor)" v={`${n2(c.d1)} × ${n2(c.d2)} cm`} />
            <Linha k="Comprimento" v={`${fmtComprimentoComercial(c.comprimento)} m`} />
            <Linha k="Volume" v={m3(c.volume)} forte />
          </> : <p className="text-sm text-muted-foreground">Medidas incompletas.</p>}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-semibold">Rastreabilidade</h2>
        <ol className="space-y-3">
          {etapas.map((e) => (
            <li key={e.txt} className="flex gap-3">
              <span className={`mt-1 h-3 w-3 rounded-full ${e.ok ? "bg-primary" : "bg-muted"}`} />
              <div><p className={e.ok ? "font-medium" : "text-muted-foreground"}>{e.txt}</p>{e.ok && e.det && <p className="text-xs text-muted-foreground">{e.det}</p>}</div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-1 flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" />Empresa responsável</h2>
        <p className="text-lg">{t.empresa_nome}</p>
        {t.autex && <p className="text-sm text-muted-foreground">Autorização de exploração: {t.autex}</p>}
      </section>
    </>
  );
}

function Info({ rotulo, valor, pequeno }: { rotulo: string; valor: string; pequeno?: boolean }) {
  return <div className="rounded-lg bg-muted p-2"><p className="text-[10px] uppercase text-muted-foreground">{rotulo}</p><p className={`font-bold ${pequeno ? "break-all text-xs" : "text-xl"}`}>{valor}</p></div>;
}
function Linha({ k, v, forte }: { k: string; v: string; forte?: boolean }) {
  return <div className="flex justify-between border-b py-1.5 text-sm last:border-0"><span className="text-muted-foreground">{k}</span><span className={forte ? "font-bold text-primary" : ""}>{v}</span></div>;
}

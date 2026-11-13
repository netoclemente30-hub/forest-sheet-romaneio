import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { CheckCircle2, GitCommitVertical, MapPin, QrCode, Ruler, Sprout, TreePine, Truck } from "lucide-react";
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
const n4 = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }));
const n0 = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
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
      <header className="border-b bg-card px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 text-primary">
          <TreePine className="h-6 w-6" />
          <div><p className="font-display text-xl font-bold leading-none">Gestor Florestal</p><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Rastreabilidade florestal</p></div>
        </div>
      </header>
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        {q.isLoading && <p className="py-10 text-center text-muted-foreground">Carregando tora…</p>}
        {q.isError && <p className="rounded-lg border border-destructive p-4 text-destructive">Não foi possível consultar agora. Tente novamente em instantes.</p>}
        {!q.isLoading && !q.isError && !t && <p className="rounded-lg border p-6 text-center text-muted-foreground">Tora não encontrada. Confira o QR Code da etiqueta.</p>}
        {t && <Detalhes t={t} />}
        <p className="pt-2 text-center text-xs text-muted-foreground"><b>Sistema de Gestão Florestal · <Link to="/apresentacao" className="underline">Gestor Florestal</Link></b><br />Documento gerado automaticamente via QR Code</p>
      </div>
    </main>
  );
}

type Publica = Database["public"]["Functions"]["tora_publica"]["Returns"][number];

function Detalhes({ t }: { t: Publica }) {
  const c = medidaComercial(t);
  const etapas = [
    { txt: "Abate", det: data(t.abatida_em), ok: !!t.abatida_em },
    { txt: "Medida e etiquetada", det: data(t.created_at), ok: true },
    { txt: "Romaneio de carga", det: t.romaneio_data ? `Carregada em ${data(t.romaneio_data)}` : "", ok: t.carregada || !!t.serrada_em },
    { txt: "Serrada", det: data(t.serrada_em), ok: !!t.serrada_em },
  ].filter((e) => e.ok);
  const temGps = t.latitude != null && t.longitude != null;
  return (
    <>
      <section className="rounded-2xl bg-forest px-4 py-8 text-center text-primary-foreground shadow-lg">
        <QrCode className="mx-auto h-8 w-8 opacity-50" />
        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] opacity-80">Gestor Florestal · Rastreabilidade</p>
        <h1 className="mt-1 font-display text-4xl font-bold">Tora Nº {t.plaqueta}</h1>
        <p className="mt-1 text-sm uppercase opacity-90">{t.especie ?? "Espécie não informada"}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/40 bg-primary-foreground/10 px-3 py-1 text-xs"><CheckCircle2 className="h-3.5 w-3.5" />Verificada &amp; Autêntica</span>
      </section>

      <Cartao icone={TreePine} titulo="Resumo da Madeira">
        <div className="grid grid-cols-2 gap-2">
          <Caixa r="Espécie / Essência" v={(t.especie ?? "—").toUpperCase()} />
          <Caixa r="Volume" v={n4(t.volume)} u="m³" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Caixa r="Comprimento" v={n2(t.comprimento)} u="m" />
          <Caixa r="Secção" v={t.secao || "—"} />
          <Caixa r="DC1" v={c ? n0(c.d1) : "—"} u="cm" />
          <Caixa r="DC2" v={c ? n0(c.d2) : "—"} u="cm" />
        </div>
        {c && <div className="mt-2 grid grid-cols-2 gap-2"><Caixa r="Comprimento comercial" v={fmtComprimentoComercial(c.comprimento)} u="m" /><Caixa r="Volume comercial" v={n4(c.volume)} u="m³" /></div>}
        {t.nome_cientifico && <Linha k="Nome científico" v={<i>{t.nome_cientifico}</i>} />}
      </Cartao>

      <Cartao icone={Ruler} titulo="Diâmetros Aferidos" extra="em centímetros">
        <div className="grid grid-cols-4 gap-2">
          <Caixa r="D1" v={n0(t.d_topo1)} /><Caixa r="D2" v={n0(t.d_topo2)} /><Caixa r="D3" v={n0(t.d_pe1)} /><Caixa r="D4" v={n0(t.d_pe2)} />
        </div>
      </Cartao>

      <Cartao icone={Sprout} titulo="Origem Florestal">
        <Linha k="Fazenda / Projeto" v={t.fazenda || t.empresa_nome} />
        <Linha k="AUTEX" v={t.autex || "—"} />
        <Linha k="Árvore Nº" v={<span className="text-primary">{t.arvore}</span>} />
        <Linha k="Empresa" v={t.empresa_nome} />
      </Cartao>

      <Cartao icone={GitCommitVertical} titulo="Linha do Tempo">
        <ol className="space-y-3">
          {etapas.map((e) => (
            <li key={e.txt} className="flex gap-3">
              <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-primary" />
              <div><p className="font-medium">{e.txt}</p>{e.det && <p className="text-xs text-muted-foreground">{e.det}</p>}</div>
            </li>
          ))}
        </ol>
      </Cartao>

      {(t.placa || t.destino) && (
        <Cartao icone={Truck} titulo="Logística & Documentos">
          {t.placa && <Linha k="Veículo" v={t.placa} />}
          {t.destino && <Linha k="Destino" v={t.destino} />}
        </Cartao>
      )}

      {temGps && (
        <Cartao icone={MapPin} titulo="Local de Extração">
          <Linha k="Latitude" v={String(t.latitude)} />
          <Linha k="Longitude" v={String(t.longitude)} />
          <a href={`https://www.google.com/maps?q=${t.latitude},${t.longitude}`} target="_blank" rel="noreferrer" className="mt-3 block rounded-lg bg-primary py-2 text-center text-sm font-semibold text-primary-foreground">Abrir no Google Maps</a>
        </Cartao>
      )}
    </>
  );
}

function Cartao({ icone: I, titulo, extra, children }: { icone: typeof TreePine; titulo: string; extra?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-4 py-3"><I className="h-4 w-4 text-primary" /><h2 className="flex-1 font-semibold">{titulo}</h2>{extra && <span className="text-xs text-muted-foreground">{extra}</span>}</div>
      <div className="p-4">{children}</div>
    </section>
  );
}
function Caixa({ r, v, u }: { r: string; v: string; u?: string }) {
  return <div className="rounded-lg border bg-muted/40 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{r}</p><p className="break-all text-lg font-bold text-primary">{v}{u && <span className="ml-1 text-xs font-normal text-muted-foreground">{u}</span>}</p></div>;
}
function Linha({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-3 border-b border-dashed py-2.5 text-sm last:border-0"><span className="text-muted-foreground">{k}</span><span className="text-right font-semibold">{v}</span></div>;
}

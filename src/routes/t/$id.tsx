import { createFileRoute, Link } from "@tanstack/react-router";
import type React from "react";
import { useEffect } from "react";
import { CheckCircle2, Factory, GitCommitVertical, MapPin, QrCode, Ruler, Sprout, Tractor, TreePine, Truck } from "lucide-react";
import { consultarFichaPublicaTora, guardarFichaPublica, lerFichaPublicaOffline } from "@/lib/consulta-tora-publica";
import type { FichaToraPublica } from "@/lib/consulta-tora-publica";
import { medidaComercial, fmtComprimentoComercial } from "@/lib/medida-comercial";
import { dataHoraSerragem, FUSO_SERRARIA, situacaoSerragem } from "@/lib/situacao-serragem";
import { EscolherAparencia } from "@/components/Aparencia";

export const Route = createFileRoute("/t/$id")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Rastreio de tora · Gestor Florestal" },
      { name: "description", content: "Origem, medidas e situação de uma tora rastreada pelo Gestor Florestal." },
      { property: "og:title", content: "Rastreio de tora · Gestor Florestal" },
      { property: "og:description", content: "Origem, medidas e situação de uma tora rastreada pelo Gestor Florestal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  // Gera a ficha ainda no SSR. Mesmo se a hidratação do WhatsApp/Android não
  // acontecer, o HTML já contém os dados ou um erro legível.
  loader: async ({ params }) => {
    try {
      return {
        tora: await consultarFichaPublicaTora(params.id),
        erro: null as string | null,
      };
    } catch (e) {
      const copia = lerFichaPublicaOffline(params.id);
      if (copia) return { tora: copia.tora, erro: null, consultadaEm: copia.consultadaEm };
      return {
        tora: null,
        erro: e instanceof Error ? e.message : "Falha na consulta pública.",
      };
    }
  },
  component: ToraPublica,
});

const n2 = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const n4 = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }));
const n0 = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
const data = (v: string | null | undefined) => {
  if (!v) return "";
  const instante = new Date(v.length === 10 ? `${v}T12:00:00Z` : v);
  return Number.isNaN(instante.getTime()) ? "" : instante.toLocaleDateString("pt-BR", {
    timeZone: FUSO_SERRARIA, day: "2-digit", month: "2-digit", year: "numeric",
  });
};

function ToraPublica() {
  const { id } = Route.useParams();
  const { tora, erro, consultadaEm } = Route.useLoaderData();
  const t = tora;
  useEffect(() => {
    if (tora && !consultadaEm) guardarFichaPublica(id, tora);
  }, [id, tora, consultadaEm]);
  return (
    <main className="min-h-screen bg-background pb-10">
      <header className="border-b bg-card px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 text-primary">
          <TreePine className="h-6 w-6" />
          <div><p className="font-display text-xl font-bold leading-none">Gestor Florestal</p><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Rastreio de tora</p></div>
          <div className="ml-auto"><EscolherAparencia /></div>
        </div>
      </header>
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        {consultadaEm && <p role="status" className="rounded-lg border bg-muted p-3 text-sm">
          Cópia offline de {dataHoraSerragem(new Date(consultadaEm).toISOString())}. Conecte-se para consultar a situação atual.
        </p>}
        {erro && (
          <div role="alert" className="space-y-3 rounded-lg border border-destructive p-4">
            <p className="font-semibold">Não foi possível abrir a ficha da tora.</p>
            <p className="text-sm text-muted-foreground">{erro}</p>
            <a href={`/t/${encodeURIComponent(id)}?tentar=1`}
              className="block w-full rounded-md bg-primary px-4 py-3 text-center font-semibold text-primary-foreground">
              Tentar novamente
            </a>
          </div>
        )}
        {!erro && !t && <p className="rounded-lg border p-6 text-center text-muted-foreground">Tora não encontrada. Confira o QR Code da etiqueta.</p>}
        {t && <Detalhes t={t} offline={Boolean(consultadaEm)} />}
        <p className="pt-2 text-center text-xs text-muted-foreground"><b>Sistema de Gestão Florestal · <Link to="/apresentacao" className="underline">Gestor Florestal</Link></b><br />Documento gerado automaticamente via QR Code</p>
      </div>
    </main>
  );
}

type Publica = FichaToraPublica;

function Detalhes({ t, offline }: { t: Publica; offline: boolean }) {
  const c = medidaComercial(t);
  const serragem = situacaoSerragem(t.serrada_em);
  const etapas = [
    { txt: "Abate", det: data(t.abatida_em), ok: !!t.abatida_em },
    { txt: "Data do Arraste", det: data(t.arrastada_em) || "Não informado", ok: true, icone: Tractor },
    { txt: "Medida e etiquetada", det: data(t.created_at), ok: true },
    { txt: "Romaneio de carga", det: t.romaneio_data ? `Carregada em ${data(t.romaneio_data)}` : "", ok: t.carregada || !!t.serrada_em },
    { txt: "Serrada", det: dataHoraSerragem(t.serrada_em) ?? "", ok: !!t.serrada_em },
  ].filter((e) => e.ok);
  const temGps = t.latitude != null && t.longitude != null;
  return (
    <>
      <section className="rounded-2xl bg-forest px-4 py-8 text-center text-forest-foreground shadow-lg">
        <QrCode className="mx-auto h-8 w-8 opacity-50" />
        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] opacity-80">Gestor Florestal · Rastreio de tora</p>
        <p className="mt-3 rounded-md border border-forest-foreground/40 bg-forest-foreground/10 px-3 py-2 text-base font-bold uppercase">Empresa: {t.empresa_nome}</p>
        <h1 className="mt-1 font-display text-4xl font-bold">Tora Nº {t.plaqueta}</h1>
        <div className="mt-4 space-y-3 border-y border-forest-foreground/30 py-4">
          <div><p className="text-xs uppercase opacity-80">AUTEX</p><p className="break-words text-base font-semibold">{t.autex || "—"}</p></div>
          <div><p className="text-xs uppercase opacity-80">Árvore</p><p className="font-display text-3xl font-bold">Nº{t.arvore} {t.secao || ""}</p></div>
        </div>
        <p className="mt-1 text-sm uppercase opacity-90">{t.especie ?? "Espécie não informada"}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-forest-foreground/40 bg-forest-foreground/10 px-3 py-1 text-xs"><CheckCircle2 className="h-3.5 w-3.5" />Verificada &amp; Autêntica</span>
      </section>

      <Cartao icone={Factory} titulo="Situação na serraria">
        <p role="status" className="mb-3 rounded-md bg-muted p-3 text-center text-lg font-bold text-primary">
          {serragem.status}
        </p>
        {serragem.serrada ? (
          <Linha k="Data e hora da serragem" v={dataHoraSerragem(t.serrada_em)} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Esta tora ainda não possui data de serragem registrada no sistema.
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {offline ? "Situação da última consulta salva." : "Situação consultada no registro atual da tora."} Horário de Rondônia (UTC−4).
        </p>
      </Cartao>

      <Cartao icone={TreePine} titulo="Resumo da Madeira">
        <div className="grid grid-cols-2 gap-2">
          <Caixa r="Espécie / Essência" v={(t.especie ?? "—").toUpperCase()} />
          <Caixa r="Secção" v={t.secao || "—"} />
        </div>
        {t.nome_cientifico && <Linha k="Nome científico" v={<i>{t.nome_cientifico}</i>} />}
      </Cartao>

      <Cartao icone={Ruler} titulo="Medida florestal (física)">
        <div className="grid grid-cols-2 gap-2">
          <Caixa r="Comprimento florestal" v={n2(t.comprimento)} u="m" />
          <Caixa r="Volume florestal" v={n4(t.volume)} u="m³" />
          <Caixa r="Topo D1" v={n0(t.d_topo1)} u="cm" />
          <Caixa r="Topo D2" v={n0(t.d_topo2)} u="cm" />
          <Caixa r="Pé D1" v={n0(t.d_pe1)} u="cm" />
          <Caixa r="Pé D2" v={n0(t.d_pe2)} u="cm" />
        </div>
      </Cartao>

      <Cartao icone={Ruler} titulo="Medida comercial">
        <div className="grid grid-cols-2 gap-2">
          <Caixa r="DC1" v={c ? n0(c.d1) : "—"} u="cm" />
          <Caixa r="DC2" v={c ? n0(c.d2) : "—"} u="cm" />
          <Caixa r="Comprimento comercial" v={c ? fmtComprimentoComercial(c.comprimento) : "—"} u="m" />
          <Caixa r="Volume comercial" v={c ? n4(c.volume) : "—"} u="m³" />
        </div>
      </Cartao>

      <Cartao icone={Sprout} titulo="Origem Florestal">
        <Linha k="Fazenda / Projeto" v={t.fazenda || t.empresa_nome} />
        <Linha k="AUTEX" v={t.autex || "—"} />
        <Linha k="Árvore Nº" v={<span className="text-primary">{t.arvore} {t.secao || ""}</span>} />
        <Linha k="Empresa" v={t.empresa_nome} />
      </Cartao>

      <Cartao icone={GitCommitVertical} titulo="Linha do Tempo">
        <ol className="space-y-3">
          {etapas.map((e) => (
            <li key={e.txt} className="flex gap-3">
              {e.icone ? <e.icone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /> :
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-primary" />}
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

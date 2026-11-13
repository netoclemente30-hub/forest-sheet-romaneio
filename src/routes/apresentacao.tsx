import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Factory, FileSpreadsheet, MapPin, QrCode, ShieldCheck, Smartphone, TreePine, Truck, WifiOff } from "lucide-react";

const TITULO = "Gestor Florestal · Do manejo à serraria, tudo rastreado";
const DESC = "App de manejo florestal: inventário, AUTEX, etiquetas com QR Code, romaneios, serraria, relatórios e trabalho offline no campo.";

export const Route = createFileRoute("/apresentacao")({
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESC },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Apresentacao,
});

const recursos = [
  { icon: TreePine, t: "Manejo e inventário", d: "Importe a ficha de campo em PDF ou Excel, controle AUTEX e meça cada tora com volume físico e comercial." },
  { icon: MapPin, t: "Cortador / Mapa", d: "Mapa georreferenciado com sua posição no GPS, registro de abate e motivo das árvores não abatidas." },
  { icon: QrCode, t: "Etiquetas com QR Code", d: "Cada tora ganha uma etiqueta. Quem ler o QR vê a origem, as medidas e a situação da tora." },
  { icon: Truck, t: "Romaneios de carga", d: "Cargas com motorista, placas e cliente, PDF pronto e envio pelo WhatsApp." },
  { icon: Factory, t: "Serraria", d: "Conferência de saldo, encaixe por volume, serragem por QR e pacotes de madeira serrada." },
  { icon: BarChart3, t: "Relatórios", d: "Rendimento, estoque consolidado e romaneios emitidos em PDF e Excel." },
  { icon: WifiOff, t: "Funciona sem sinal", d: "Lance tudo no mato. Os dados sincronizam sozinhos quando o sinal voltar." },
  { icon: ShieldCheck, t: "Auditoria completa", d: "Quem lançou, quando, onde e em qual aparelho. Cada empresa vê apenas os próprios dados." },
];

function Apresentacao() {
  return (
    <main className="min-h-screen bg-background">
      <section className="bg-forest px-5 pb-16 pt-10 text-primary-foreground">
        <div className="mx-auto max-w-4xl">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest opacity-80"><TreePine className="h-5 w-5" />Gestor Florestal</p>
          <h1 className="mt-6 font-display text-4xl font-bold leading-tight sm:text-6xl">Do manejo à serraria,<br />cada tora rastreada.</h1>
          <p className="mt-4 max-w-xl text-lg opacity-90">{DESC}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="https://wa.me/5569999004121?text=Quero%20conhecer%20o%20Gestor%20Florestal" className="rounded-lg bg-primary-foreground px-5 py-3 font-semibold text-primary">Falar no WhatsApp</a>
            <Link to="/" className="rounded-lg border border-primary-foreground/50 px-5 py-3 font-semibold">Entrar no app</Link>
          </div>
        </div>
      </section>
      <section className="mx-auto -mt-8 max-w-4xl px-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {recursos.map((r) => (
            <article key={r.t} className="rounded-xl border bg-card p-5 shadow-sm">
              <r.icon className="h-7 w-7 text-primary" />
              <h2 className="mt-3 font-display text-xl font-bold">{r.t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{r.d}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-5 py-14 text-center">
        <Smartphone className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-3 font-display text-3xl font-bold">Instale no celular e comece hoje</h2>
        <p className="mx-auto mt-2 max-w-lg text-muted-foreground">Funciona no Android e no iPhone, direto do navegador. Cada empresa recebe seu próprio acesso.</p>
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground"><FileSpreadsheet className="h-4 w-4" />Planilhas e PDFs no padrão que você já usa.</p>
      </section>
    </main>
  );
}

import { LogoGestor } from "@/components/LogoGestor";
import { useState } from "react";
import { VersaoAplicativo } from "@/components/VersaoAplicativo";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  MessageCircle,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormularioLogin, WHATS_ACESSO } from "@/components/FormularioLogin";
import { FormularioCadastro } from "@/components/FormularioCadastro";
import {
  IlusAuditoria,
  IlusEmpresas,
  IlusEtiqueta,
  IlusManejo,
  IlusMapa,
  IlusOffline,
  IlusRelatorio,
  IlusRomaneio,
  IlusSerraria,
} from "./Ilustracoes";

const WHATS_FALA = "https://wa.me/5569996109506?text=Quero%20conhecer%20o%20Gestor%20Florestal";

const modulos = [
  {
    ilus: IlusManejo,
    t: "Manejo com medida física e comercial",
    d: "Importe a ficha de campo em PDF ou Excel, controle as AUTEX e meça cada tora nas duas pontas.",
    itens: [
      "Volume físico (Smalian) e volume comercial lado a lado",
      "Ponta mais fina e comprimento para baixo, de meio em meio metro",
      "Compara a medida do sistema com a medida do físico",
    ],
  },
  {
    ilus: IlusEtiqueta,
    t: "Etiquetas com QR Code rastreável",
    d: "Cada tora sai do mato com uma etiqueta própria. Quem lê o QR abre a página da tora na hora.",
    itens: [
      "QR com plaqueta, árvore, seção, espécie e AUTEX",
      "Página pública de rastreabilidade, sem precisar de login",
      "Imprime por seleção ou em lote, na ordem de lançamento",
    ],
  },
  {
    ilus: IlusSerraria,
    t: "Serraria e encaixe de saldo",
    d: "Confira o saldo da serraria, encaixe a tora medida pelo volume e monte pacotes de madeira serrada.",
    itens: [
      "Conferir saldo aceita AUTESP sem seção",
      "Encaixe por volume com confirmação explícita da identidade",
      "Pacotes 5×15, 5×10 e 5×7 com comprimentos de 1,0 a 9,0 m",
    ],
  },
  {
    ilus: IlusRomaneio,
    t: "Romaneios com TXT NF-e",
    d: "Carga com cliente, motorista, CPF e placas. O romaneio sai em PDF e o TXT da NF-e pronto para usar.",
    itens: [
      "PDF A4 paisagem com subtotais, totais e assinaturas",
      "TXT NF-e delimitado, para baixar, copiar ou enviar",
      "Envio direto pelo WhatsApp com o resumo da carga",
    ],
  },
  {
    ilus: IlusOffline,
    t: "Funciona 100% offline no mato",
    d: "Sem sinal não é motivo para parar. Tudo é lançado no aparelho e enviado quando o sinal voltar.",
    itens: [
      "Lançamentos guardados no aparelho, um por um, com GPS",
      "Sincroniza sozinho na ordem em que foram feitos",
      "Conflito vira aviso — nenhum dado é jogado fora",
    ],
  },
];

const passos = [
  { n: "1", t: "Importe a base", d: "Ficha de campo em PDF ou Excel, com picadas entre páginas e DAP por CAP." },
  { n: "2", t: "Meça e etiquete", d: "Toras medidas no celular, com volume físico e comercial e etiqueta impressa." },
  { n: "3", t: "Carregue", d: "Romaneio com motorista, placas e cliente, PDF e TXT NF-e na hora." },
  { n: "4", t: "Confira o saldo", d: "Encaixe as toras da serraria por volume e acompanhe o estoque consolidado." },
];

const extras = [
  { ilus: IlusMapa, t: "Cortador / Mapa", d: "Mapa georreferenciado, sua posição no GPS e registro de abate ou do motivo da árvore não abatida." },
  { ilus: IlusRelatorio, t: "Relatórios", d: "Rendimento, romaneios emitidos e estoque consolidado em PDF e Excel." },
  { ilus: IlusAuditoria, t: "Auditoria completa", d: "Quem lançou, quando, em qual aparelho e em que ponto do terreno." },
  { ilus: IlusEmpresas, t: "Uma empresa por vez", d: "Cada empresa vê apenas os próprios saldos e toras. Nada se mistura." },
];

export function ApresentacaoPagina() {
  const [aberto, setAberto] = useState(false);
  const [cadastro, setCadastro] = useState(false);
  const abrirCadastro = () => { setCadastro(true); setAberto(true); };

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-forest text-primary-foreground">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
          <LogoGestor className="size-9" />
          <div className="min-w-0">
            <p className="font-display text-xl font-bold uppercase leading-none">Gestor Florestal</p>
            <p className="text-[11px] uppercase tracking-widest opacity-75 hidden sm:block">Do manejo à serraria</p>
          </div>
          <div className="ml-auto grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Button asChild variant="outline" className="min-h-11 px-2 border-primary-foreground/50 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"><Link to="/engenheiro">Área do Engenheiro</Link></Button>
          <Button
            size="lg"
            className="h-11 px-2 shrink-0 bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => { setCadastro(false); setAberto(true); }}
          >
            Acessar sistema
            <ArrowRight className="size-4" />
          </Button>
          </div>
        </div>
      </header>

      <section className="bg-forest px-5 pb-20 pt-10 text-primary-foreground">
        <div className="mx-auto max-w-4xl">
          <h1 className="font-display text-4xl font-bold uppercase leading-[0.95] sm:text-6xl">
            Cada tora medida,<br />etiquetada e<br /><span className="text-accent">rastreada.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg opacity-90">
            Inventário, AUTEX, etiquetas com QR Code, romaneios, serraria e relatórios em um
            aplicativo que funciona no mato, mesmo sem sinal.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="outline" className="h-12 border-primary-foreground/50 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"><Link to="/engenheiro">Área do Engenheiro</Link></Button>
            <Button size="lg" className="h-12 bg-accent px-6 text-base text-accent-foreground hover:bg-accent/90" onClick={() => { setCadastro(false); setAberto(true); }}>
              Acessar sistema
              <ArrowRight className="size-4" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 border-primary-foreground/50 bg-transparent px-5 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={abrirCadastro}>
              Cadastrar empresa grátis
            </Button>
            <a
              href={WHATS_FALA}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-md border border-primary-foreground/50 px-5 font-semibold"
            >
              <MessageCircle className="size-4" />
              Falar no WhatsApp
            </a>
          </div>
          <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm opacity-80">
            <span className="flex items-center gap-1.5"><Check className="size-4 text-accent" /> Android e iPhone</span>
            <span className="flex items-center gap-1.5"><Check className="size-4 text-accent" /> Planilha e PDF no padrão que você já usa</span>
            <span className="flex items-center gap-1.5"><Check className="size-4 text-accent" /> Acesso liberado pelo administrador</span>
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pt-12">
        <h2 className="font-display text-3xl font-bold uppercase text-primary">Como funciona</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {passos.map((p) => (
            <li key={p.n} className="rounded-xl border bg-card p-4 shadow-sm">
              <span className="flex size-8 items-center justify-center rounded-full bg-accent font-display text-lg font-bold text-accent-foreground">{p.n}</span>
              <h3 className="mt-3 font-display text-xl font-bold uppercase leading-tight">{p.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-5 md:grid-cols-2">
          {modulos.map((m) => (
            <article key={m.t} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="bg-muted/60 px-4 pb-1 pt-4">
                <m.ilus className="h-36 w-full text-primary" />
              </div>
              <div className="p-5">
                <h3 className="font-display text-2xl font-bold uppercase leading-tight">{m.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{m.d}</p>
                <ul className="mt-3 space-y-1.5">
                  {m.itens.map((i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y bg-muted/40 px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-2xl font-bold uppercase text-primary">E mais</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {extras.map((e) => (
              <article key={e.t} className="rounded-xl border bg-card p-4 shadow-sm">
                <e.ilus className="h-24 w-full text-primary" />
                <h3 className="mt-2 font-display text-lg font-bold uppercase leading-tight">{e.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{e.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 text-center">
        <Smartphone className="mx-auto size-10 text-primary" />
        <h2 className="mt-3 font-display text-3xl font-bold uppercase">Instale no celular e comece hoje</h2>
        <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
          Funciona no Android e no iPhone, direto do navegador. Cada empresa recebe seu próprio acesso.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button size="lg" className="h-12 px-6" onClick={() => { setCadastro(false); setAberto(true); }}>
            Acessar sistema
            <ArrowRight className="size-4" />
          </Button>
          <Button size="lg" variant="secondary" className="h-12 px-6" onClick={abrirCadastro}>
            Cadastrar empresa grátis
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-6">
            <a href={WHATS_FALA} target="_blank" rel="noreferrer">Falar no WhatsApp</a>
          </Button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Não tem acesso?{" "}
          <a className="font-semibold text-primary underline" href={WHATS_ACESSO} target="_blank" rel="noreferrer">
            Peça pelo WhatsApp
          </a>{" "}
          · <Link to="/apresentacao" className="text-primary underline">sobre o app</Link>
        </p>
      </section>

      <footer className="px-4 pb-4 text-center"><VersaoAplicativo /></footer>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl uppercase">{cadastro ? "Cadastrar empresa" : "Acessar sistema"}</DialogTitle>
            <DialogDescription>
              {cadastro ? "Comece em demonstração com até 50 toras. A ficha de campo pode ser importada completa." : "Entre com o e-mail e a senha liberados pelo administrador."}
            </DialogDescription>
          </DialogHeader>
          {cadastro ? <FormularioCadastro onEntrar={() => setCadastro(false)} /> : (
            <>
              <FormularioLogin />
              <p className="text-center text-sm text-muted-foreground">
                Empresa nova?{" "}
                <button type="button" className="font-semibold text-primary underline" onClick={() => setCadastro(true)}>Cadastre grátis</button>
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

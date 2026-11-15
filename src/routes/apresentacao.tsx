import { createFileRoute } from "@tanstack/react-router";
import { ApresentacaoPagina } from "@/components/apresentacao/ApresentacaoPagina";

const TITULO = "Gestor Florestal · Do manejo à serraria, tudo rastreado";
const DESC = "App de manejo florestal: inventário, AUTEX, etiquetas com QR Code, romaneios com TXT NF-e, serraria, relatórios e trabalho offline no mato.";

export const Route = createFileRoute("/apresentacao")({
  staticData: { sitemap: true },
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
  component: ApresentacaoPagina,
});

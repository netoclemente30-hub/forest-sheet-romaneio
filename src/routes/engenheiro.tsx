import { createFileRoute } from "@tanstack/react-router";
import { EngenheiroPagina } from "@/components/engenheiro/EngenheiroPagina";

export const Route = createFileRoute("/engenheiro")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Área do Engenheiro · Gestor Florestal" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: EngenheiroPagina,
});

import { createFileRoute } from "@tanstack/react-router";
import { TorasList } from "./toras";

export const Route = createFileRoute("/estoque")({
  head: () => ({ meta: [
    { title: "Estoque de toras — Manejo Florestal" },
    { name: "description", content: "Toras disponíveis, AUTEX e seleção de etiquetas QR." },
    { property: "og:title", content: "Estoque de toras — Manejo Florestal" },
    { property: "og:description", content: "Toras disponíveis, AUTEX e seleção de etiquetas QR." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <TorasList estoque />,
});
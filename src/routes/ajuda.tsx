import { createFileRoute } from "@tanstack/react-router";
import { Download, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const PDF = "/downloads/manual-gestor-florestal.pdf";

export const Route = createFileRoute("/ajuda")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Ajuda e manual — Gestor Florestal" },
      { name: "description", content: "Manual operacional do Gestor Florestal para equipes de campo e escritório." },
      { property: "og:title", content: "Ajuda e manual — Gestor Florestal" },
      { property: "og:description", content: "Manual operacional do Gestor Florestal para equipes de campo e escritório." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Ajuda,
});

function Ajuda() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Manual operacional</h1>
            <p className="text-sm text-muted-foreground">Guia de uso para as equipes de campo e escritório.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><a href={PDF} target="_blank" rel="noopener">Abrir em tela cheia</a></Button>
          <Button asChild><a href={PDF} download="Manual_Gestor_Florestal.pdf"><Download className="mr-2 h-4 w-4" />Baixar PDF</a></Button>
        </div>
      </div>
      <iframe src={PDF} title="Manual operacional do Gestor Florestal" className="h-[75vh] w-full rounded-md border bg-card" />
    </div>
  );
}

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { torasQuery } from "@/lib/data";
import { ToraLabel } from "@/components/ToraLabel";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/etiquetas")({
  validateSearch: (s: Record<string, unknown>) => ({ p: typeof s["p"] === "string" ? s["p"] : String(s["p"] ?? "") }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Etiquetas QR — Manejo Florestal" },
      { name: "description", content: "Imprima etiquetas com QR code para colar nas toras." },
      { property: "og:title", content: "Etiquetas QR — Manejo Florestal" },
      { property: "og:description", content: "Imprima etiquetas com QR code para colar nas toras." },
    ],
  }),
  component: Etiquetas,
});

function Etiquetas() {
  const { p } = Route.useSearch();
  const router = useRouter();
  const toras = useQuery(torasQuery);
  const lista = [...new Set(p.split(",").map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))];
  const selecionadas = lista.flatMap((pl) => { const t = toras.data?.find((x) => x.plaqueta === pl); return t ? [t] : []; });
  return (
    <div>
      <div className="no-print flex gap-2 mb-4">
        <Button variant="outline" onClick={() => router.history.back()}><ArrowLeft /> Voltar</Button>
        <Button disabled={!selecionadas.length || toras.isLoading} className="flex-1" onClick={() => window.print()}><Printer /> Imprimir {selecionadas.length} etiqueta(s)</Button>
      </div>
      {toras.isLoading && <p>Carregando etiquetas…</p>}
      {toras.isError && <p className="text-destructive">Não foi possível carregar as etiquetas.</p>}
      <div className="label-sheet">
        {selecionadas.map((t) => <ToraLabel key={t.plaqueta} tora={t} />)}
      </div>
    </div>
  );
}

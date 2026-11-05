import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { torasQuery } from "@/lib/data";
import { QrImage } from "@/components/QrImage";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/etiquetas")({
  validateSearch: (s: Record<string, unknown>) => ({ p: typeof s["p"] === "string" ? s["p"] : String(s["p"] ?? "") }),
  head: () => ({
    meta: [
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
  const lista = p.split(",").map(Number).filter(Boolean);
  return (
    <div>
      <div className="no-print flex gap-2 mb-4">
        <Button variant="outline" onClick={() => router.history.back()}><ArrowLeft /> Voltar</Button>
        <Button className="flex-1" onClick={() => window.print()}><Printer /> Imprimir {lista.length} etiqueta(s)</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {lista.map((pl) => {
          const t = toras.data?.find((x) => x.plaqueta === pl);
          return (
            <div key={pl} className="border-2 border-foreground rounded-lg p-2 flex flex-col items-center bg-card break-inside-avoid">
              <QrImage value={String(pl)} size={130} />
              <div className="font-display text-3xl font-bold leading-none">{pl}</div>
              <div className="text-xs text-center">{t?.especie} · Árv {t?.arvore} · Sec {t?.secao}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

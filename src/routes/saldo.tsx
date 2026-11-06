import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { torasQuery } from "@/lib/data";
import { conferirSaldo, lerSaldo, type LinhaSaldo } from "@/lib/saldo";
import { fmtM3 } from "@/lib/volume";
import { Button } from "@/components/ui/button";
import { Printer, Upload } from "lucide-react";

export const Route = createFileRoute("/saldo")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Conferir saldo — Manejo Florestal" },
      { name: "description", content: "Confira o saldo da serraria com a planilha e imprima as plaquetas." },
      { property: "og:title", content: "Conferir saldo — Manejo Florestal" },
      { property: "og:description", content: "Confira o saldo da serraria com a planilha e imprima as plaquetas." },
    ],
  }),
  component: Saldo,
});

function Saldo() {
  const toras = useQuery(torasQuery);
  const [linhas, setLinhas] = useState<LinhaSaldo[]>([]);
  const res = useMemo(() => conferirSaldo(linhas, toras.data ?? []), [linhas, toras.data]);
  const ok = res.filter((r) => r.tora);
  const fora = res.length - ok.length;

  async function abrir(f: File) {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer());
      const l = lerSaldo(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 }));
      setLinhas(l);
      toast.success(`${l.length} linhas lidas`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível ler a planilha"); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold uppercase">Conferir saldo</h1>
      <p className="text-sm text-muted-foreground">Envie o Excel com AUTEX, nome científico, espécie, árvore, secção e volume. Cada linha é procurada nas toras pelo AUTEX + árvore + secção.</p>
      <label className="block">
        <Button asChild variant="outline" className="w-full"><span><Upload /> Escolher planilha de saldo</span></Button>
        <input type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && abrir(e.target.files[0])} />
      </label>
      {res.length > 0 && <>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-forest text-primary-foreground p-3"><b className="text-2xl">{ok.length}</b><div className="text-xs">em estoque · {fmtM3(ok.reduce((n, r) => n + Number(r.tora!.volume), 0))} m³</div></div>
          <div className="rounded-lg bg-destructive text-destructive-foreground p-3"><b className="text-2xl">{fora}</b><div className="text-xs">fora de estoque</div></div>
        </div>
        <Button asChild className="w-full" disabled={!ok.length}><Link to="/etiquetas" search={{ p: ok.map((r) => r.tora!.plaqueta).join(",") }}><Printer /> Imprimir plaquetas ({ok.length})</Link></Button>
        <div className="bg-card border rounded-xl divide-y">
          {res.map((r, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="font-display text-xl font-bold w-14">{r.tora?.plaqueta ?? "—"}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.linha.especie}{r.linha.nome_cientifico && <span className="text-muted-foreground"> · {r.linha.nome_cientifico}</span>}</div>
                <div className="text-xs text-muted-foreground">Árv. {r.linha.arvore} · Sec. {r.linha.secao || "–"} · AUTEX {r.linha.autex || "—"} · {fmtM3(Number(r.tora?.volume ?? r.linha.volume ?? 0))} m³</div>
              </div>
              {!r.tora && <span className="text-xs font-bold text-destructive uppercase">Fora de estoque</span>}
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}

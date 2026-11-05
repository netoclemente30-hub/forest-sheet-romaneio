import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { volumeTora } from "@/lib/volume";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/importar")({
  head: () => ({
    meta: [
      { title: "Importar planilha — Manejo Florestal" },
      { name: "description", content: "Importe a BASE e os Cálculos de Inventário do Excel." },
      { property: "og:title", content: "Importar planilha — Manejo Florestal" },
      { property: "og:description", content: "Importe a BASE e os Cálculos de Inventário do Excel." },
    ],
  }),
  component: Importar,
});

type Row = unknown[];
const n = (v: unknown) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));

async function chunks<T>(arr: T[], size: number, fn: (c: T[]) => Promise<void>, onProgress: (done: number) => void) {
  for (let i = 0; i < arr.length; i += size) {
    await fn(arr.slice(i, i + size));
    onProgress(Math.min(i + size, arr.length));
  }
}

function Importar() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function processar(file: File) {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const base = wb.Sheets["BASE"];
      const calc = wb.Sheets["Calculos_Inventario"];
      if (!base || !calc) throw new Error("A planilha precisa das abas BASE e Calculos_Inventario");

      const arvores = new Map<number, { numero: number; nome_vulgar: string; cap: number | null; dap: number | null; altura: number | null; volume: number | null; categoria: string | null; picada: string | null }>();
      let picada: string | null = null;
      for (const r of XLSX.utils.sheet_to_json<Row>(base, { header: 1 })) {
        const a = r[0];
        if (typeof a === "string" && a.toLowerCase().startsWith("picada")) picada = a.split(":")[1]?.trim() ?? a;
        if (typeof a === "number" && r[1]) {
          arvores.set(a, { numero: a, nome_vulgar: String(r[1]), cap: n(r[2]), dap: n(r[3]), altura: n(r[4]), volume: n(r[5]), categoria: r[6] ? String(r[6]) : null, picada });
        }
      }

      const toras = new Map<number, Record<string, unknown>>();
      let dup = 0;
      for (const r of XLSX.utils.sheet_to_json<Row>(calc, { header: 1 }).slice(1)) {
        const pl = n(r[0]);
        const arv = n(r[1]);
        if (!pl || arv === null) continue;
        if (toras.has(pl)) { dup++; continue; }
        const m = { d_topo1: n(r[4]), d_topo2: n(r[5]), d_pe1: n(r[6]), d_pe2: n(r[7]), comprimento: n(r[10]) };
        toras.set(pl, {
          plaqueta: pl, arvore: arv, especie: arvores.get(arv)?.nome_vulgar ?? "Não cadastrada",
          secao: r[3] ? String(r[3]) : null, ...m, volume: volumeTora(m),
          carregada: String(r[12] ?? "").toLowerCase() === "carregada",
        });
      }

      const av = [...arvores.values()];
      setStatus(`Enviando ${av.length} árvores…`);
      await chunks(av, 500, async (c) => {
        const { error } = await supabase.from("arvores").upsert(c);
        if (error) throw error;
      }, (d) => setStatus(`Árvores: ${d}/${av.length}`));

      const tv = [...toras.values()];
      await chunks(tv, 500, async (c) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.from("toras").upsert(c as any, { onConflict: "plaqueta", ignoreDuplicates: true });
        if (error) throw error;
      }, (d) => setStatus(`Toras: ${d}/${tv.length}`));

      await qc.invalidateQueries();
      setStatus(`Pronto! ${av.length} árvores e ${tv.length} toras importadas.${dup ? ` ${dup} plaqueta(s) repetida(s) ignorada(s).` : ""}`);
      toast.success("Planilha importada");
    } catch (e) {
      toast.error((e as Error).message);
      setStatus("");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold uppercase">Importar planilha</h1>
      <p className="text-sm text-muted-foreground">
        Envie o arquivo Excel (.xlsx ou .xlsm) com as abas <b>BASE</b> e <b>Calculos_Inventario</b>. Árvores são atualizadas;
        toras novas são adicionadas e as que já existem no app não são alteradas.
      </p>
      <label className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary p-8 text-center bg-card ${busy ? "opacity-50" : "cursor-pointer"}`}>
        <FileSpreadsheet className="size-10 text-primary" />
        <span className="font-semibold">Escolher arquivo</span>
        <input type="file" accept=".xlsx,.xlsm,.xls" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && processar(e.target.files[0])} />
      </label>
      {status && <div className="rounded-lg bg-secondary p-3 text-sm">{status}</div>}
      {busy && <Button disabled className="w-full">Importando…</Button>}
    </div>
  );
}

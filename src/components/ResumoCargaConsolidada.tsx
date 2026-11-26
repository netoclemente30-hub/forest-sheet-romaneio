import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { salvarArquivo } from "@/lib/arquivo";
import type { LinhaCarga } from "@/lib/carga-consolidada";
import { fmtM3 } from "@/lib/volume";

export function ResumoCargaConsolidada({ linhas }: { linhas: LinhaCarga[] }) {
  const [ocupado, setOcupado] = useState(false);
  if (!linhas.length) return null;

  async function exportar(formato: "xlsx" | "pdf") {
    setOcupado(true);
    try {
      const { gerarCargaConsolidada } = await import("@/lib/exportar-carga-consolidada");
      await salvarArquivo(await gerarCargaConsolidada(formato, linhas));
    } catch {
      toast.error("Não foi possível exportar o romaneio consolidado.");
    } finally { setOcupado(false); }
  }

  return <details className="rounded-lg border bg-card p-3">
    <summary className="cursor-pointer font-semibold">Resumo por espécie, produto e autorização</summary>
    <ul className="mt-2 divide-y text-sm">{linhas.map(l =>
      <li className="py-2" key={JSON.stringify([l.especie, l.produto, l.autorizacao])}>
        {l.especie} · {l.produto} · {l.autorizacao} · {l.pecas} peças · {fmtM3(l.volume)} m³
      </li>)}</ul>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={ocupado} onClick={() => void exportar("xlsx")}>Exportar Excel</Button>
      <Button type="button" variant="outline" disabled={ocupado} onClick={() => void exportar("pdf")}>Exportar PDF A4</Button>
    </div>
  </details>;
}

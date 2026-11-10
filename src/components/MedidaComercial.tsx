import type { MedidasTora } from "@/lib/medida-comercial";
import { fmtComprimentoComercial, medidaComercial } from "@/lib/medida-comercial";
import { fmtM3 } from "@/lib/volume";
import { Button } from "@/components/ui/button";

export type ModoMedida = "fisica" | "comercial";

export function SeletorMedida({ valor, onChange }: { valor: ModoMedida; onChange: (modo: ModoMedida) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2" aria-label="Tipo de medida">
      <Button type="button" variant={valor === "fisica" ? "default" : "outline"} aria-pressed={valor === "fisica"} onClick={() => onChange("fisica")}>Medida física</Button>
      <Button type="button" variant={valor === "comercial" ? "default" : "outline"} aria-pressed={valor === "comercial"} onClick={() => onChange("comercial")}>Medida comercial</Button>
    </div>
  );
}

export function TextoMedidaComercial({ tora, classe = "text-xs" }: { tora: MedidasTora; classe?: string }) {
  const comercial = medidaComercial(tora);
  if (!comercial) return <div className={`${classe} text-muted-foreground`}>Comercial: preencha as quatro medidas e o comprimento</div>;
  return (
    <div className={classe}>
      <span className="font-semibold">Comercial:</span> {comercial.d1}×{comercial.d2} cm · {fmtComprimentoComercial(comercial.comprimento)} m · <span className="font-semibold">{fmtM3(comercial.volume)} m³</span>
    </div>
  );
}

export function CartaoMedidaComercial({ tora }: { tora: MedidasTora }) {
  const comercial = medidaComercial(tora);
  const fisico = Number(tora.volume ?? 0);
  return (
    <div className="rounded-lg border-2 border-primary bg-secondary p-3 space-y-1">
      <div className="text-sm font-bold uppercase">Medida comercial</div>
      {comercial ? <>
        <div className="text-lg font-semibold">{comercial.d1}×{comercial.d2} cm · {fmtComprimentoComercial(comercial.comprimento)} m</div>
        <div className="text-xs text-muted-foreground">Diâmetros da ponta mais fina ({comercial.ponta === "topo" ? "topo" : "pé"})</div>
        <div className="flex flex-wrap justify-between gap-2 pt-1 text-sm">
          <span>Comercial: <b>{fmtM3(comercial.volume)} m³</b></span>
          <span>Físico: <b>{fmtM3(fisico)} m³</b></span>
        </div>
        <div className="text-sm font-semibold">Diferença: {comercial.volume - fisico >= 0 ? "+" : ""}{fmtM3(comercial.volume - fisico)} m³</div>
      </> : <div className="text-sm text-muted-foreground">Informe as quatro medidas de diâmetro e o comprimento para calcular.</div>}
    </div>
  );
}

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fila, type ItemFila } from "@/lib/offline/fila";
import { camposDaFila, corrigirOp, edicaoDaFila, rascunhoDaFila } from "@/lib/offline/editar";
import { torasQuery, type Tora } from "@/lib/data";
import { volumeMedido } from "@/lib/tora-edit";
import { fmtM3 } from "@/lib/volume";
import { torasEtiquetasOffline } from "@/lib/encaixe-salvar";

export function EditarLancamento({ item, onDone }: { item: ItemFila; onDone: () => void }) {
  const qc = useQueryClient();
  const toras = qc.getQueryData<Tora[]>(torasQuery.queryKey) ?? [];
  const [valores, setValores] = useState(() => rascunhoDaFila(item.op, toras));
  const [busy, setBusy] = useState(false);
  const edicao = edicaoDaFila(item.op, valores);
  const vol = edicao ? volumeMedido(edicao) : 0;

  async function salvar() {
    setBusy(true);
    try {
      const itens = (await fila().listar()).filter((i) => i.id !== item.id);
      const empresa = edicao?.empresa_id;
      const estoque = [...toras, ...(empresa ? torasEtiquetasOffline(itens, empresa) : [])];
      const op = corrigirOp(item.op, valores, estoque);
      await fila().editarErro(item.id, op);
      toast.success("Alterações salvas. Toque em Tentar de novo para enviar.");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(ev) => { ev.preventDefault(); void salvar(); }}>
      <div className="grid grid-cols-2 gap-3">
        {camposDaFila(item.op).map((campo) => (
          <div key={campo.chave} className={campo.mode === "numeric" || campo.mode === "decimal" ? "space-y-1 min-w-0" : "col-span-2 space-y-1 min-w-0"}>
            <Label htmlFor={`fila-${campo.chave}`}>{campo.rotulo}</Label>
            <Input id={`fila-${campo.chave}`} inputMode={campo.mode ?? "text"} value={valores[campo.chave] ?? ""} disabled={busy} onChange={(ev) => setValores((v) => ({ ...v, [campo.chave]: ev.target.value }))} />
          </div>
        ))}
      </div>
      {vol > 0 && <div className="flex flex-wrap items-center justify-between gap-2 text-sm bg-secondary p-3 rounded-md">
        <span>Volume medido: <b>{fmtM3(vol)} m³</b></span>
        <Button type="button" variant="outline" size="sm" onClick={() => setValores((v) => ({ ...v, volume: String(vol) }))}>Usar esse volume</Button>
      </div>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}><Save /> {busy ? "Salvando…" : "Salvar alterações"}</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  );
}
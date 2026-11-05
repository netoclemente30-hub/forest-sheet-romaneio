import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Arvore, Tora } from "@/lib/data";
import { volumeTora, fmtM3 } from "@/lib/volume";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

export function ToraForm({ toras, arvores, onSaved }: { toras: Tora[]; arvores: Arvore[]; onSaved: (plaqueta: number) => void }) {
  const qc = useQueryClient();
  const proxima = useMemo(() => toras.reduce((m, t) => Math.max(m, t.plaqueta), 0) + 1, [toras]);
  const [f, setF] = useState({ plaqueta: String(proxima), arvore: "", secao: "A", d_topo1: "", d_topo2: "", d_pe1: "", d_pe2: "", comprimento: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const especie = arvores.find((a) => a.numero === Number(f.arvore))?.nome_vulgar;
  const medidas = { d_topo1: num(f.d_topo1), d_topo2: num(f.d_topo2), d_pe1: num(f.d_pe1), d_pe2: num(f.d_pe2), comprimento: num(f.comprimento) };
  const vol = volumeTora(medidas);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const plaqueta = Number(f.plaqueta);
    if (toras.some((t) => t.plaqueta === plaqueta)) return toast.error(`Plaqueta ${plaqueta} já existe`);
    setBusy(true);
    const { error } = await supabase.from("toras").insert({
      plaqueta, arvore: Number(f.arvore), especie: especie ?? "Não cadastrada", secao: f.secao, ...medidas, volume: vol,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Tora ${plaqueta} salva — ${fmtM3(vol)} m³`);
    await qc.invalidateQueries({ queryKey: ["toras"] });
    onSaved(plaqueta);
    setF({ ...f, plaqueta: String(plaqueta + 1), secao: String.fromCharCode(f.secao.charCodeAt(0) + 1), d_topo1: "", d_topo2: "", d_pe1: "", d_pe2: "", comprimento: "" });
  }

  const field = (k: keyof typeof f, label: string, mode: "numeric" | "decimal" | "text" = "numeric") => (
    <div className="space-y-1">
      <Label htmlFor={k} className="text-xs">{label}</Label>
      <Input id={k} inputMode={mode} value={f[k]} onChange={set(k)} required={k !== "secao"} className="h-11 text-lg" />
    </div>
  );

  return (
    <form onSubmit={salvar} className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {field("plaqueta", "Plaqueta azul")}
        {field("arvore", "Nº árvore")}
        {field("secao", "Secção", "text")}
      </div>
      <div className={`text-sm rounded-md px-3 py-2 ${especie ? "bg-secondary" : "bg-muted text-muted-foreground"}`}>
        Espécie: <b>{f.arvore ? especie ?? "Não cadastrada na BASE" : "—"}</b>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {field("d_topo1", "D. Topo 1 (cm)")}
        {field("d_topo2", "D. Topo 2 (cm)")}
        {field("d_pe1", "D. Pé 1 (cm)")}
        {field("d_pe2", "D. Pé 2 (cm)")}
      </div>
      {field("comprimento", "Comprimento (m)", "decimal")}
      <div className="flex items-center justify-between rounded-lg bg-forest text-primary-foreground px-4 py-3">
        <span className="text-sm opacity-80">Volume</span>
        <span className="font-display text-2xl font-bold">{fmtM3(vol)} m³</span>
      </div>
      <Button type="submit" size="lg" className="w-full h-12" disabled={busy}>Salvar tora</Button>
    </form>
  );
}

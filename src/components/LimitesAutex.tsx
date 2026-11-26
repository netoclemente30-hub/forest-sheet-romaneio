import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fila } from "@/lib/offline/fila";
import { sincronizar } from "@/lib/offline/sync";
import { capturarLog } from "@/lib/registro";
import type { Json } from "@/integrations/supabase/types";
import { fmtM3 } from "@/lib/volume";
import { limitesDe, nomeEspecieNormalizado } from "./AvisosManejo";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function LimitesAutex({ autex, podeEditar }: { autex: { empresa_id: string; numero: string; limites_especies?: Json }; podeEditar: boolean }) {
  const qc = useQueryClient();
  const [especie, setEspecie] = useState("");
  const [cientifico, setCientifico] = useState("");
  const [volume, setVolume] = useState("");
  const [busy, setBusy] = useState(false);
  const limites = limitesDe(autex);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !podeEditar) return;
    const valor = Number(volume.trim().replace(",", "."));
    if (!especie.trim() || !volume.trim() || !Number.isFinite(valor) || valor < 0) {
      toast.error("Informe a espécie e o volume autorizado em m³."); return;
    }
    const ref = nomeEspecieNormalizado(cientifico || especie);
    const novos = limites.filter(l => nomeEspecieNormalizado(l.nome_cientifico || l.especie) !== ref);
    novos.push({ especie: especie.trim(), nome_cientifico: cientifico.trim(), volume_m3: valor });
    setBusy(true);
    try {
      const log = await capturarLog("Limite autorizado por espécie atualizado", `AUTEX ${autex.numero} · ${especie} · ${fmtM3(valor)} m³`);
      await fila().enfileirar({ tipo: "campo_update", tabela: "autex", empresa_id: autex.empresa_id, chave: "numero", alvo: autex.numero, dados: { limites_especies: novos }, limitesAnteriores: autex.limites_especies ?? null, log });
      setEspecie(""); setCientifico(""); setVolume("");
      toast.success("Limite guardado neste aparelho para sincronização.");
      void sincronizar(fila()).then(() => qc.invalidateQueries({ queryKey: ["autex"] })).catch(() => {});
    } catch {
      toast.error("Não foi possível guardar o limite autorizado.");
    } finally { setBusy(false); }
  }

  return <details className="rounded-xl border bg-card p-3">
    <summary className="cursor-pointer font-semibold">Volume autorizado por espécie</summary>
    <ul className="my-2 space-y-1 text-sm">{limites.map(l =>
      <li key={l.nome_cientifico || l.especie}>{l.especie} {l.nome_cientifico && `(${l.nome_cientifico})`} · {fmtM3(l.volume_m3)} m³</li>)}</ul>
    {!limites.length && <p className="my-2 text-sm text-muted-foreground">Nenhum limite cadastrado para esta AUTEX.</p>}
    {podeEditar && <form className="flex flex-wrap items-end gap-2" onSubmit={salvar}>
      <label className="text-sm">Espécie<Input value={especie} required onChange={e => setEspecie(e.target.value)} /></label>
      <label className="text-sm">Nome científico<Input value={cientifico} onChange={e => setCientifico(e.target.value)} /></label>
      <label className="text-sm">Volume autorizado (m³)<Input value={volume} required inputMode="decimal" onChange={e => setVolume(e.target.value)} /></label>
      <Button disabled={busy}>Salvar limite</Button>
    </form>}
  </details>;
}

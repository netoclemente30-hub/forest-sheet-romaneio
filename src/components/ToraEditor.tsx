// Painel de edição de uma tora já lançada: corrige dados e medidas, ou exclui a tora.
// Online grava na hora; sem internet enfileira para enviar quando conectar.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tora } from "@/lib/data";
import { fmtM3 } from "@/lib/volume";
import { fila } from "@/lib/offline/fila";
import { estaOnline } from "@/lib/offline/sync";
import { capturarLog, gravarRegistro } from "@/lib/registro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import {
  dadosDaEdicao,
  editarDe,
  num,
  validarEdicao,
  volumeMedido,
  type EdicaoTora,
} from "@/lib/tora-edit";

// Exclui uma tora (com confirmação). Retorna true quando ela foi excluída
// ou enfileirada para exclusão — quem chama atualiza a lista nesse caso.
export async function excluirTora(t: Tora): Promise<boolean> {
  const aviso = t.carregada ? " Ela já foi carregada em um romaneio." : "";
  if (!window.confirm(`Excluir a tora da plaqueta ${t.plaqueta}? Essa ação não pode ser desfeita.${aviso}`)) return false;
  const log = await capturarLog("Tora excluída", `Plaqueta ${t.plaqueta} · árvore ${t.arvore}${t.secao ? `-${t.secao}` : ""} · ${t.especie ?? "sem espécie"}`);
  if (!estaOnline()) {
    await fila().enfileirar({ tipo: "tora_delete", plaqueta: t.plaqueta, empresa_id: t.empresa_id, log });
    toast.success(`Plaqueta ${t.plaqueta} guardada para excluir — será enviada quando conectar`);
    return true;
  }
  const { error } = await supabase.from("toras").delete().eq("plaqueta", t.plaqueta).eq("empresa_id", t.empresa_id);
  if (error) {
    toast.error(error.message);
    return false;
  }
  await gravarRegistro(log);
  toast.success(`Plaqueta ${t.plaqueta} excluída`);
  return true;
}

export function ToraEditor({ tora, toras, onDone }: { tora: Tora; toras: Tora[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [e, setE] = useState<EdicaoTora>(() => editarDe(tora));
  const [busy, setBusy] = useState(false);
  const set = (k: keyof EdicaoTora) => (ev: React.ChangeEvent<HTMLInputElement>) => setE((s) => ({ ...s, [k]: ev.target.value }));
  const vol = volumeMedido(e);
  const digitado = num(e.volume) ?? 0;
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["toras"] });
    onDone();
  };

  async function salvar() {
    const erro = validarEdicao(e, toras);
    if (erro) {
      toast.error(erro);
      return;
    }
    const dados = dadosDaEdicao(e);
    const mudouPlaqueta = dados.plaqueta !== e.plaqueta;
    const log = await capturarLog(
      "Tora editada",
      `Plaqueta ${mudouPlaqueta ? `${e.plaqueta} → ${dados.plaqueta}` : e.plaqueta} · ${dados.especie ?? "sem espécie"} · árvore ${dados.arvore}${dados.secao ? `-${dados.secao}` : ""} · ${fmtM3(dados.volume)} m³`,
    );
    setBusy(true);
    if (!estaOnline()) {
      await fila().enfileirar({ tipo: "tora_update", plaqueta: e.plaqueta, empresa_id: e.empresa_id, autex: dados.autex, dados, log });
      setBusy(false);
      toast.success(`Plaqueta ${dados.plaqueta} salva offline — será enviada quando conectar`);
      onDone();
      return;
    }
    // A AUTEX digitada precisa existir no cadastro da empresa antes de gravar na tora.
    if (dados.autex) {
      const { error: ea } = await supabase
        .from("autex")
        .upsert({ numero: dados.autex, empresa_id: e.empresa_id }, { onConflict: "empresa_id,numero", ignoreDuplicates: true });
      if (ea) {
        setBusy(false);
        toast.error(ea.message);
        return;
      }
    }
    const { error } = await supabase.from("toras").update(dados).eq("plaqueta", e.plaqueta).eq("empresa_id", e.empresa_id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await gravarRegistro(log);
    toast.success(mudouPlaqueta ? `Plaqueta ${e.plaqueta} alterada para ${dados.plaqueta}` : `Plaqueta ${e.plaqueta} alterada`);
    await refresh();
  }

  async function excluir() {
    setBusy(true);
    const ok = await excluirTora(tora);
    setBusy(false);
    if (ok) await refresh();
  }

  const campo = (k: keyof EdicaoTora, label: string, mode: "numeric" | "decimal" | "text" = "numeric") => (
    <div className="space-y-1">
      <Label htmlFor={`ed-${k}`} className="text-xs">{label}</Label>
      <Input id={`ed-${k}`} inputMode={mode} value={e[k]} onChange={set(k)} className="h-11 text-lg" />
    </div>
  );

  return (
    <div className="space-y-3">
      {(tora.carregada || tora.serrada_em) && (
        <div className="rounded-md bg-secondary px-3 py-2 text-sm">
          {tora.carregada && "Esta tora já foi carregada em um romaneio. "}
          {tora.serrada_em && "Ela está marcada como serrada."}
        </div>
      )}
      {campo("plaquetaNova", "Plaqueta azul")}
      <div className="grid grid-cols-2 gap-2">
        {campo("arvore", "Nº árvore")}
        {campo("secao", "Secção", "text")}
      </div>
      {campo("especie", "Espécie (nome popular)", "text")}
      {campo("nome_cientifico", "Nome científico", "text")}
      {campo("autex", "AUTEX", "text")}
      {campo("volume", "Volume (m³)", "decimal")}
      {vol > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-secondary px-3 py-2 text-sm">
          <span>Pelo que foi medido: <b>{fmtM3(vol)} m³</b></span>
          {Math.abs(vol - digitado) > 0.0005 && (
            <Button type="button" size="sm" variant="outline" onClick={() => setE((s) => ({ ...s, volume: String(vol) }))}>
              Usar esse volume
            </Button>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {campo("d_topo1", "D. topo 1 (cm)")}
        {campo("d_topo2", "D. topo 2 (cm)")}
        {campo("d_pe1", "D. pé 1 (cm)")}
        {campo("d_pe2", "D. pé 2 (cm)")}
      </div>
      {campo("comprimento", "Comprimento (m)", "decimal")}
      <Button className="w-full h-12" disabled={busy} onClick={salvar}>Salvar alterações</Button>
      <Button variant="destructive" className="w-full" disabled={busy} onClick={excluir}><Trash2 /> Excluir tora</Button>
    </div>
  );
}

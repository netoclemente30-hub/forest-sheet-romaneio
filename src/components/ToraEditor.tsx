// Painel de edição de uma tora já lançada: corrige dados e medidas, ou exclui a tora.
// Online grava na hora; sem internet enfileira para enviar quando conectar.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Tora } from "@/lib/data";
import { fmtM3 } from "@/lib/volume";
import { CartaoMedidaComercial } from "@/components/MedidaComercial";
import { fila } from "@/lib/offline/fila";
import { estaOnline } from "@/lib/offline/sync";
import { sincronizar } from "@/lib/offline/sync";
import { corrigirToraLocal } from "@/lib/offline/editar-tora";
import { capturarLog } from "@/lib/registro";
import { registrarOperacao } from "@/lib/registro-operacao";
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
  try { await registrarOperacao("tora_delete", t.empresa_id, {}, [t.plaqueta], log); }
  catch (error) {
    toast.error(error instanceof Error ? error.message : "Não foi possível excluir");
    return false;
  }
  toast.success(`Plaqueta ${t.plaqueta} excluída`);
  return true;
}

export function ToraEditor({ tora, toras, onDone, podeExcluir = true }: { tora: Tora; toras: Tora[]; onDone: () => void; podeExcluir?: boolean }) {
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
    setBusy(true);
    try {
    const dados = dadosDaEdicao(e);
    if (await corrigirToraLocal(fila(), tora, dados)) {
      toast.success('Correção guardada neste aparelho. A tora já aparece com os novos dados.');
      onDone();
      return;
    }
    if (!podeExcluir) throw new Error('Este lançamento já saiu da lista local. Atualize a lista antes de editar.');
    const mudouPlaqueta = dados.plaqueta !== e.plaqueta;
    const log = await capturarLog(
      "Tora editada",
      `Plaqueta ${mudouPlaqueta ? `${e.plaqueta} → ${dados.plaqueta}` : e.plaqueta} · ${dados.especie ?? "sem espécie"} · árvore ${dados.arvore}${dados.secao ? `-${dados.secao}` : ""} · ${fmtM3(dados.volume)} m³`,
    );
    setBusy(true);
    await fila().enfileirar({ tipo: "tora_update", plaqueta: e.plaqueta, empresa_id: e.empresa_id, autex: dados.autex, dados, log });
    toast.success(`Plaqueta ${dados.plaqueta} guardada neste aparelho — será enviada quando conectar`);
    onDone();
    void sincronizar(fila()).then(r => { if (r.enviados) void qc.invalidateQueries({queryKey:['toras']}); }).catch(() => {});
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar neste aparelho"); }
    finally { setBusy(false); }
  }

  async function excluir() {
    setBusy(true);
    try { const ok = await excluirTora(tora); if (ok) await refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir"); }
    finally { setBusy(false); }
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
      <CartaoMedidaComercial tora={{ d_topo1: num(e.d_topo1), d_topo2: num(e.d_topo2), d_pe1: num(e.d_pe1), d_pe2: num(e.d_pe2), comprimento: num(e.comprimento), volume: digitado }} />
      <Button className="w-full h-12" disabled={busy} onClick={salvar}>Salvar alterações</Button>
      {podeExcluir && <Button variant="destructive" className="w-full" disabled={busy} onClick={excluir}><Trash2 /> Excluir tora</Button>}
    </div>
  );
}

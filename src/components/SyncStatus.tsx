import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudOff, RefreshCw, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import { fila, assinarFila, type ItemFila, type Op } from "@/lib/offline/fila";
import { sincronizar, estaOnline } from "@/lib/offline/sync";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function descrever(op: Op): string {
  if (op.log?.detalhe) return `${op.log.acao} · ${op.log.detalhe}`;
  switch (op.tipo) {
    case "tora_insert": return `Tora lançada · plaqueta ${String(op.dados["plaqueta"] ?? "?")}`;
    case "tora_update": return `Tora editada · plaqueta ${op.plaqueta}`;
    case "tora_delete": return `Tora excluída · plaqueta ${op.plaqueta}`;
    case "romaneio_salvar": return `Romaneio ${op.cab.placa} · ${op.qtd_toras} toras`;
    case "romaneio_recebido": return `Entrada no pátio ${op.patio}`;
    case "toras_serradas": return `${op.desfazer ? "Voltar ao pátio" : "Serrar"} · ${op.plaquetas.length} toras`;
  }
}

function explicar(erro: string): string {
  if (/duplicate key|toras_pkey/i.test(erro)) return "Essa plaqueta já existe na nuvem (outra pessoa já lançou esse número).";
  if (/foreign key|autex_fkey/i.test(erro)) return "A AUTEX desse lançamento não está cadastrada.";
  if (/row-level security|permission/i.test(erro)) return "Este login não tem permissão para gravar isso.";
  return erro;
}

export function SyncStatus() {
  const qc = useQueryClient();
  const [online, setOnline] = useState(true);
  const [itens, setItens] = useState<ItemFila[]>([]);
  const [sync, setSync] = useState(false);
  const [aberto, setAberto] = useState(false);
  const pendentes = itens.filter((i) => !i.erro).length;
  const comErro = itens.filter((i) => i.erro);
  const erros = comErro.length;

  const atualizar = useCallback(async () => {
    setOnline(estaOnline());
    setItens(await fila().listar());
  }, []);

  const tentarSync = useCallback(async () => {
    await atualizar();
    if (!estaOnline()) return;
    setSync(true);
    const r = await sincronizar(fila());
    setSync(false);
    await atualizar();
    if (r.enviados > 0) {
      toast.success(`${r.enviados} lançamento(s) offline enviados para a nuvem`);
      qc.invalidateQueries();
    }
    if (r.erros > 0) toast.error(`${r.erros} lançamento(s) com erro — toque no aviso laranja para ver`);
  }, [atualizar, qc]);

  useEffect(() => {
    const desassinar = assinarFila(() => void atualizar());
    window.addEventListener("online", tentarSync);
    window.addEventListener("offline", atualizar);
    void tentarSync();
    return () => {
      desassinar();
      window.removeEventListener("online", tentarSync);
      window.removeEventListener("offline", atualizar);
    };
  }, [atualizar, tentarSync]);

  async function tentarDeNovo(id: string) {
    await fila().limparErro(id);
    await tentarSync();
  }

  async function descartar(item: ItemFila) {
    if (!window.confirm(`Descartar este lançamento? Ele não será enviado.\n\n${descrever(item.op)}`)) return;
    await fila().remover(item.id);
    toast.success("Lançamento descartado");
  }

  useEffect(() => {
    if (aberto && erros === 0) setAberto(false);
  }, [aberto, erros]);

  if (online && !pendentes && !erros && !sync) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => erros && setAberto(true)}
        className={`no-print w-full px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 ${
          !online ? "bg-destructive text-destructive-foreground" : erros ? "bg-amber-500 text-white" : "bg-secondary text-secondary-foreground"
        }`}
        role="status"
      >
        {!online ? (
          <><CloudOff className="size-3.5" /> Sem internet — {pendentes} lançamento(s) serão enviados quando conectar</>
        ) : sync ? (
          <><RefreshCw className="size-3.5 animate-spin" /> Sincronizando…</>
        ) : erros ? (
          <><AlertTriangle className="size-3.5" /> {erros} lançamento(s) com erro ao enviar — toque para ver</>
        ) : (
          <><CheckCircle2 className="size-3.5" /> Tudo sincronizado</>
        )}
      </button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lançamentos com erro</DialogTitle>
            <DialogDescription>Estes lançamentos ficaram guardados neste aparelho e não foram para a nuvem.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {comErro.map((i) => (
              <div key={i.id} className="rounded-md border p-3 space-y-2">
                <div className="font-semibold text-sm">{descrever(i.op)}</div>
                <div className="text-xs text-muted-foreground">{new Date(i.op.log?.criado_em ?? i.criadoEm).toLocaleString("pt-BR")}</div>
                <div className="text-sm text-destructive">{explicar(i.erro!)}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={sync} onClick={() => tentarDeNovo(i.id)}><RefreshCw /> Tentar de novo</Button>
                  <Button size="sm" variant="destructive" onClick={() => descartar(i)}><Trash2 /> Descartar</Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

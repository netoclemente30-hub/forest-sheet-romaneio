import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudOff, RefreshCw, CheckCircle2, AlertTriangle, Trash2, Pencil } from "lucide-react";
import { fila, assinarFila, type ItemFila, type Op } from "@/lib/offline/fila";
import { sincronizar, estaOnline } from "@/lib/offline/sync";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EditarLancamento } from "@/components/EditarLancamento";

function descrever(op: Op): string {
  if (op.log?.detalhe) return `${op.log.acao} · ${op.log.detalhe}`;
  switch (op.tipo) {
    case 'pacote_serrado_salvar': return `Pacote de madeira serrada ${op.cab.numero}`;
    case "tora_insert": return `Tora lançada · plaqueta ${String(op.dados["plaqueta"] ?? "?")}`;
    case "tora_update": return `Tora editada · plaqueta ${op.plaqueta}`;
    case "tora_delete": return `Tora excluída · plaqueta ${op.plaqueta}`;
    case "romaneio_salvar": return `Romaneio ${op.cab.placa} · ${op.qtd_toras} toras`;
    case "romaneio_recebido": return `Entrada no pátio ${op.patio}`;
    case "toras_serradas": return `${op.desfazer ? "Voltar ao pátio" : "Serrar"} · ${op.plaquetas.length} toras`;
    case "arvore_gps": return `Árvore localizada · AUTEX ${op.autex}`;
    case "aguardando_insert": return `Tora não identificada NI-${String(op.dados["numero"] ?? "?")}`;
    case "rastro_salvar": return `Rastreio GPS · AUTEX ${op.autex} · ${op.pontos.length} pontos`;
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
  const [editando, setEditando] = useState<ItemFila | null>(null);
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
      <Button
        type="button"
        onClick={() => erros && setAberto(true)}
        variant="ghost"
        className={`no-print w-full h-auto rounded-none whitespace-normal px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 ${
          erros ? "bg-warning text-foreground hover:bg-warning" : !online ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground"
        }`}
        role="status"
      >
        {erros && !sync ? (
          <><AlertTriangle className="size-3.5 shrink-0" /> {erros} lançamento(s) com erro ao enviar — toque para ver</>
        ) : !online ? (
          <><CloudOff className="size-3.5" /> Sem internet — {pendentes} lançamento(s) serão enviados quando conectar</>
        ) : sync ? (
          <><RefreshCw className="size-3.5 animate-spin" /> Sincronizando…</>
        ) : erros ? (
          <><AlertTriangle className="size-3.5" /> {erros} lançamento(s) com erro ao enviar — toque para ver</>
        ) : (
          <><CheckCircle2 className="size-3.5" /> Tudo sincronizado</>
        )}
      </Button>
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
                <div className="text-sm text-destructive break-words">{explicar(i.erro ?? "")}</div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={sync} onClick={() => tentarDeNovo(i.id)}><RefreshCw /> Tentar de novo</Button>
                  {i.op.tipo !== "rastro_salvar" && <Button size="sm" variant="outline" disabled={sync} onClick={() => setEditando(i)}><Pencil /> Editar</Button>}
                  <Button size="sm" variant="destructive" disabled={sync} onClick={() => descartar(i)}><Trash2 /> Descartar</Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editando} onOpenChange={(open) => { if (!open) setEditando(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar lançamento com erro</DialogTitle>
            <DialogDescription>{editando ? descrever(editando.op) : ""}</DialogDescription>
          </DialogHeader>
          {editando && <EditarLancamento key={editando.id} item={editando} onDone={() => setEditando(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

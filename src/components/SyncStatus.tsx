import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudOff, RefreshCw, AlertTriangle, Trash2, Pencil } from "lucide-react";
import { fila, assinarFila, type ItemFila, type Op } from "@/lib/offline/fila";
import { sincronizar, estaOnline } from "@/lib/offline/sync";
import { verificarBackend } from "@/lib/offline/conexao";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EditarLancamento } from "@/components/EditarLancamento";

function descrever(op: Op): string {
  if (op.log?.detalhe) return `${op.log.acao} · ${op.log.detalhe}`;
  switch (op.tipo) {
    case 'estoque_operacao': return op.log.detalhe;
    case 'aguardando_delete': return 'Exclusão de tora não identificada';
    case 'cadastro_upsert': return `Cadastro ${op.tabela}`;
    case 'romaneio_importado_salvar': return `Romaneio importado ${op.cab.numero_carga}`;
    case 'campo_update': return `Alteração de ${op.tabela} · ${op.alvo}`;
    case 'pacote_serrado_salvar': return `Pacote de madeira serrada ${op.cab.numero}`;
    case "tora_insert": return `Tora lançada · plaqueta ${String(op.dados["plaqueta"] ?? "?")}`;
    case "tora_update": return `Tora editada · plaqueta ${op.plaqueta}`;
    case "toras_etiquetas": return `Etiquetas emitidas · ${op.plaquetas.length} toras`;
    case "tora_delete": return `Tora excluída · plaqueta ${op.plaqueta}`;
    case "romaneio_salvar": return `Romaneio ${op.cab.placa} · ${op.qtd_toras} toras`;
    case "romaneio_recebido": return `Entrada no pátio ${op.patio}`;
    case "toras_serradas": return `${op.desfazer ? "Voltar ao pátio" : "Serrar"} · ${op.plaquetas.length} toras`;
    case "arvore_gps": return `Árvore localizada · AUTEX ${op.autex}`;
    case "arrasto_toras": return `Arrasto da árvore ${op.arvore} · ${op.plaquetas.length} toras`;
    case "arrasto_arvore": return `Arrasto da árvore ${op.arvore} · AUTEX ${op.autex}`;
    case "transferencia_explanada": return `Transferência da tora ${op.plaqueta} · AUTEX ${op.autex}`;
    case "aguardando_insert": return `Tora não identificada NI-${String(op.dados["numero"] ?? "?")}`;
    case "aguardando_update": return `Tora não identificada editada NI-${String(op.dados["numero"] ?? "?")}`;
    case "aguardando_impressa": return `Etiqueta de tora não identificada · ${op.imprimiu ? "impressa" : "não impressa"}`;
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
  const ocupada = useRef(false);
  const [armazenamentoErro, setArmazenamentoErro] = useState("");
  const [online, setOnline] = useState(true);
  const [itens, setItens] = useState<ItemFila[]>([]);
  const [sync, setSync] = useState(false);
  const [enviando, setEnviando] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<ItemFila | null>(null);
  const [semCache, setSemCache] = useState(false);
  const pendentes = itens.filter((i) => !i.erro).length;
  const comErro = itens.filter((i) => i.erro);
  const erros = comErro.length;

  const atualizar = useCallback(async () => {
    setOnline(estaOnline());
    try { setItens(await fila().listar()); setArmazenamentoErro(""); }
    catch (e) { setArmazenamentoErro(e instanceof Error ? e.message : "Armazenamento indisponível; não feche lançamentos não confirmados."); }
  }, []);

  const tentarSync = useCallback(async () => {
    if (ocupada.current) return;
    ocupada.current = true;
    try {
      await atualizar();
      const disponivel = await verificarBackend();
      setOnline(disponivel);
      if (!disponivel) return;
      setEnviando((await fila().listar()).filter(i => !i.erro).length);
      setSync(true);
      const r = await sincronizar(fila(), undefined, async () => disponivel);
      if (r.enviados > 0) { toast.success(`${r.enviados} lançamento(s) enviados para a nuvem`); void qc.invalidateQueries(); }
      if (r.erros > 0) toast.error(`${r.erros} lançamento(s) com erro — toque no aviso para corrigir`);
    } catch (e) { setArmazenamentoErro(e instanceof Error ? e.message : "Não foi possível acessar os lançamentos locais."); }
    finally { setSync(false); ocupada.current = false; await atualizar(); }
  }, [atualizar, qc]);

  useEffect(() => {
    const cacheStatus = (event: Event) => {
      const detalhe = (event as CustomEvent<{ ausente: boolean }>).detail;
      if (detalhe?.ausente) setSemCache(true);
    };
    window.addEventListener('cache-disponibilidade', cacheStatus);
    const desassinar = assinarFila(() => { void atualizar(); void qc.invalidateQueries(); });
    window.addEventListener("online", tentarSync);
    window.addEventListener("offline", atualizar);
    const retomar = () => { if (document.visibilityState !== "hidden") void tentarSync(); };
    document.addEventListener("visibilitychange", retomar);
    window.addEventListener("focus", retomar);
    const intervalo = window.setInterval(retomar, 30000);
    void tentarSync();
    return () => {
      document.removeEventListener("visibilitychange", retomar);
      window.removeEventListener("focus", retomar);
      window.clearInterval(intervalo);
      window.removeEventListener('cache-disponibilidade', cacheStatus);
      desassinar();
      window.removeEventListener("online", tentarSync);
      window.removeEventListener("offline", atualizar);
    };
  }, [atualizar, tentarSync]);

  async function tentarDeNovo(id: string) {
    try { await fila().limparErro(id); await tentarSync(); } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível tentar novamente"); }
  }

  async function descartar(item: ItemFila) {
    if (!window.confirm(`Descartar este lançamento? Ele não será enviado.\n\n${descrever(item.op)}`)) return;
    try { await fila().remover(item.id); toast.success("Lançamento descartado"); } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível descartar"); }
  }

  useEffect(() => {
    if (aberto && erros === 0) setAberto(false);
  }, [aberto, erros]);

  if (armazenamentoErro) return <p role="alert" className="p-3 text-sm text-destructive">{armazenamentoErro}</p>;
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
          <><CloudOff className="size-3.5" /> Servidor indisponível — {pendentes} lançamento(s) guardados neste aparelho; envio após reconexão</>
        ) : sync ? (
          <><RefreshCw className="size-3.5 animate-spin" /> {enviando > 0 ? `Sincronizando ${enviando} ${enviando === 1 ? "item" : "itens"}…` : "Sincronizando…"}</>
        ) : erros ? (
          <><AlertTriangle className="size-3.5" /> {erros} lançamento(s) com erro ao enviar — toque para ver</>
        ) : (
          <><RefreshCw className="size-3.5" /> {pendentes} lançamento(s) guardados — aguardando envio</>
        )}
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lançamentos com erro</DialogTitle>
            <DialogDescription>Estes lançamentos estão guardados neste aparelho. Envios sem confirmação serão consultados na próxima tentativa, sem alterar seus dados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {comErro.map((i) => (
              <div key={i.id} className="rounded-md border p-3 space-y-2">
                <div className="font-semibold text-sm">{descrever(i.op)}</div>
                <div className="text-xs text-muted-foreground">{new Date(i.op.log?.criado_em ?? i.criadoEm).toLocaleString("pt-BR")}</div>
                <div className="text-sm text-destructive break-words">{explicar(i.erro ?? "")}</div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={sync} onClick={() => tentarDeNovo(i.id)}><RefreshCw /> Tentar de novo</Button>
                  {!i.envio_iniciado && i.op.tipo !== 'estoque_operacao' && i.op.tipo !== 'aguardando_delete' && i.op.tipo !== "rastro_salvar" && i.op.tipo !== "arrasto_toras" && i.op.tipo !== "arrasto_arvore" && i.op.tipo !== "transferencia_explanada" && <Button size="sm" variant="outline" disabled={sync} onClick={() => setEditando(i)}><Pencil /> Editar</Button>}
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

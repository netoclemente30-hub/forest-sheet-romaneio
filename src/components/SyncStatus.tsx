import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudOff, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { fila, assinarFila } from "@/lib/offline/fila";
import { sincronizar, estaOnline } from "@/lib/offline/sync";
import { toast } from "sonner";

export function SyncStatus() {
  const qc = useQueryClient();
  const [online, setOnline] = useState(true);
  const [pendentes, setPendentes] = useState(0);
  const [erros, setErros] = useState(0);
  const [sync, setSync] = useState(false);

  useEffect(() => {
    const atualizar = async () => {
      setOnline(estaOnline());
      const itens = await fila().listar();
      setPendentes(itens.filter((i) => !i.erro).length);
      setErros(itens.filter((i) => i.erro).length);
    };
    const tentarSync = async () => {
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
      if (r.erros > 0) toast.error(`${r.erros} lançamento(s) com erro — verifique e lance novamente`);
    };
    void atualizar();
    const desassinar = assinarFila(() => void atualizar());
    window.addEventListener("online", tentarSync);
    window.addEventListener("offline", atualizar);
    void tentarSync(); // ao abrir o app, envia o que ficou pendente
    return () => {
      desassinar();
      window.removeEventListener("online", tentarSync);
      window.removeEventListener("offline", atualizar);
    };
  }, [qc]);

  if (online && !pendentes && !erros && !sync) return null;

  return (
    <div
      className={`no-print px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 ${
        !online ? "bg-destructive text-destructive-foreground" : erros ? "bg-amber-500 text-white" : "bg-secondary text-secondary-foreground"
      }`}
      role="status"
    >
      {!online ? (
        <>
          <CloudOff className="size-3.5" /> Sem internet — {pendentes} lançamento(s) serão enviados quando conectar
        </>
      ) : sync ? (
        <>
          <RefreshCw className="size-3.5 animate-spin" /> Sincronizando…
        </>
      ) : erros ? (
        <>
          <AlertTriangle className="size-3.5" /> {erros} lançamento(s) com erro ao enviar
        </>
      ) : (
        <>
          <CheckCircle2 className="size-3.5" /> Tudo sincronizado
        </>
      )}
    </div>
  );
}

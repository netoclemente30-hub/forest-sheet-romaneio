import { useEffect, useState } from "react";
import { assinarFila, fila, type ItemFila } from "@/lib/offline/fila";

/** Reads persistent operations on mount and reacts to saves, errors and discards. */
export function useFilaOffline() {
  const [itens, setItens] = useState<ItemFila[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let ativo = true;
    let versao = 0;
    const atualizar = async () => {
      const atual = ++versao;
      try {
        const lista = await fila().listar();
        if (ativo && atual === versao) { setItens(lista); setErro(false); setCarregando(false); }
      } catch {
        if (ativo && atual === versao) { setErro(true); setCarregando(false); }
      }
    };
    const cancelar = assinarFila(() => void atualizar());
    void atualizar();
    return () => { ativo = false; cancelar(); };
  }, []);
  return { itens, carregando, erro };
}
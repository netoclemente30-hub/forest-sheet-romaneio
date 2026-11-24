import { useEffect, useState } from "react";
import { prepararDadosOffline, type ProgressoOffline } from "@/lib/offline/preparar";
import { lerCache } from "@/lib/offline/cache";
import { verificarBackend } from "@/lib/offline/conexao";
import { Button } from "./ui/button";
import { PAGINAS_OFFLINE, paginaOfflinePlugin } from "@/lib/pwa-policy";
import { hostnameBloqueado } from "@/lib/pwa-register";

export function PrepararOffline({ usuario, empresa }: { usuario: string; empresa: string }) {
  const [progresso, setProgresso] = useState<ProgressoOffline | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [ultima, setUltima] = useState<number | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [telasProntas, setTelasProntas] = useState(false);
  useEffect(() => {
    let ativo = true;
    const conferir = async () => {
      try {
        if (
          !import.meta.env.PROD ||
          window.self !== window.top ||
          hostnameBloqueado(window.location.hostname)
        )
          return;
        if (
          !("serviceWorker" in navigator) ||
          !navigator.serviceWorker.controller ||
          !("caches" in window)
        )
          return;
        const paginas = await Promise.all(
          PAGINAS_OFFLINE.map(async (url) =>
            paginaOfflinePlugin.cachedResponseWillBeUsed({
              cachedResponse: (await caches.match(url)) ?? null,
            }),
          ),
        );
        if (ativo) setTelasProntas(paginas.every(Boolean));
      } catch {
        /* A cópia dos dados continua disponível na sessão aberta. */
      }
    };
    void conferir();
    const timer = window.setInterval(conferir, 10000);
    return () => {
      ativo = false;
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const abortar = new AbortController();
    let rodando = false;
    const preparar = async () => {
      if (rodando || !navigator.onLine) return;
      rodando = true;
      setOcupado(true);
      try {
        await verificarBackend();
        if (abortar.signal.aborted || !navigator.onLine) return;
        const p = await prepararDadosOffline(
          usuario,
          empresa,
          (p) => {
            if (!abortar.signal.aborted) setProgresso(p);
          },
          abortar.signal,
        );
        if (!abortar.signal.aborted && p.atualizadoEm) setUltima(p.atualizadoEm);
      } catch (e) {
        if (!abortar.signal.aborted)
          setProgresso({
            etapa: "Interrompido",
            concluidas: 0,
            total: 0,
            falhas: [e instanceof Error ? e.message : "Não foi possível preparar a cópia offline."],
          });
      } finally {
        rodando = false;
        if (!abortar.signal.aborted) setOcupado(false);
      }
    };
    void lerCache<number>("preparacao-offline", empresa).then((v) => {
      if (!abortar.signal.aborted) setUltima(v?.[0] ?? null);
    });
    void preparar();
    window.addEventListener("online", preparar);
    return () => {
      abortar.abort();
      window.removeEventListener("online", preparar);
    };
  }, [usuario, empresa, tentativa]);
  return (
    <div className="no-print mx-4 my-2 rounded-md border px-3 py-2 text-sm" role="status">
      {ocupado
        ? `Guardando dados neste aparelho: ${progresso?.etapa ?? "Verificando conexão"} (${progresso?.concluidas ?? 0}/${progresso?.total ?? "…"}). Aguarde antes de ficar offline.`
        : progresso?.falhas.length
          ? "Cópia offline incompleta. Algumas informações ainda precisam de internet."
          : ultima
            ? `Dados guardados neste aparelho em ${new Date(ultima).toLocaleString("pt-BR")}.`
            : "Conecte à internet para preparar os dados offline neste aparelho."}
      {!ocupado && (
        <Button
          variant="outline"
          size="sm"
          className="ml-2"
          onClick={() => setTentativa((t) => t + 1)}
        >
          Atualizar cópia offline
        </Button>
      )}
      {!!progresso?.falhas.length && (
        <details>
          <summary>Ver pendências da cópia</summary>
          <ul>
            {progresso.falhas.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-xs">
        {telasProntas
          ? "Telas preparadas para reabrir sem internet."
          : "A abertura das telas sem internet ainda não foi confirmada. Mantenha o app aberto com internet; a prévia dentro do editor não oferece instalação offline."}
      </p>
      <p className="text-xs text-muted-foreground">
        Os dados são os da última cópia. Novos lançamentos ficam neste aparelho até sincronizar.
        Emissão fiscal e consultas externas exigem internet.
      </p>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock3, LoaderCircle, Tractor } from "lucide-react";
import type { Arvore, Tora } from "@/lib/data";
import { torasQuery } from "@/lib/data";
import { validarPosicaoArrasto, situacaoArrasto } from "@/lib/arrasto";
import { registrarArrasto } from "@/lib/arrasto-salvar";
import { assinarFila, fila } from "@/lib/offline/fila";
import { Button } from "./ui/button";
import { fmtM3 } from "@/lib/volume";

export function ArrastoToras({
  arvore, empresa, toras, encerrado,
}: {
  arvore: Arvore;
  empresa: string;
  toras: Tora[];
  encerrado: boolean;
}) {
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const [pendentesFila, setPendentesFila] = useState<number[]>([]);

  const status = useMemo(
    () => situacaoArrasto(arvore, empresa, toras),
    [arvore, empresa, toras],
  );
  // Detecta a implantação da migração a partir do SELECT já usado pelo mapa.
  // Antes da migração, o painel mostra a prévia sem liberar gravações.
  const bancoHabilitado = toras.some((t) =>
    t.empresa_id === empresa && Object.prototype.hasOwnProperty.call(t, "arrastada_em"),
  );

  useEffect(() => {
    let ativo = true;
    async function atualizar() {
      try {
        const itens = await fila().listar();
        if (!ativo) return;
        setPendentesFila(
          [...new Set(itens.filter(({ op }) =>
            op.tipo === "arrasto_toras" &&
            op.empresa_id === empresa &&
            op.autex === arvore.autex &&
            op.arvore === arvore.numero,
          ).flatMap(({ op }) => op.tipo === "arrasto_toras" ? op.plaquetas : []))],
        );
      } catch {
        if (ativo) setPendentesFila([]);
      }
    }
    const cancelar = assinarFila(() => { void atualizar(); });
    void atualizar();
    return () => { ativo = false; cancelar(); };
  }, [arvore.autex, arvore.numero, empresa]);

  const bloqueadas = new Set(pendentesFila);
  const disponiveis = status.disponiveis.filter((t) => !bloqueadas.has(t.plaqueta));
  const assinatura = disponiveis.map((t) => t.plaqueta).join(",");

  useEffect(() => {
    setSelecionadas(assinatura ? assinatura.split(",").map(Number) : []);
  }, [arvore.id, assinatura]);

  async function registrar() {
    if (ocupado || !arvore.abatida_em || !bancoHabilitado || encerrado || !selecionadas.length) return;
    if (!navigator.geolocation) {
      toast.error("Este aparelho não oferece GPS. Não é possível registrar o arrasto.");
      return;
    }
    setOcupado(true);
    try {
      // Captura de fato a posição do TRATORISTA ao concluir o arrasto.
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, maximumAge: 0, timeout: 20000,
        });
      });
      const gps = {
        lat: pos.coords.latitude, lng: pos.coords.longitude,
        precisao: pos.coords.accuracy,
        capturado_em: new Date(pos.timestamp).toISOString(),
      };
      const erro = validarPosicaoArrasto(arvore, gps);
      if (erro) throw new Error(erro);
      const confirmacao = "Confirmar arrasto concluído de " + selecionadas.length +
        " tora(s) da árvore " + arvore.numero + "?\n\n" +
        "Confirme o serviço junto à árvore. A data, o operador e o GPS serão guardados.";
      if (!window.confirm(confirmacao)) return;

      const resultado = await registrarArrasto({
        arvore, empresa, plaquetas: selecionadas, gps,
      });
      if (!resultado.offline) {
        await qc.invalidateQueries({ queryKey: torasQuery.queryKey });
      }
      toast.success(resultado.offline
        ? "Arrasto guardado neste aparelho. Aguardando sincronização."
        : "Arrasto de " + selecionadas.length + " tora(s) confirmado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar o arrasto.");
    } finally {
      setOcupado(false);
    }
  }

  if (!arvore.abatida_em) return null;

  return (
    <section className="space-y-3 rounded-lg border bg-secondary/40 p-3" aria-label="Arrasto das toras da árvore">
      <div className="flex items-start gap-2">
        <Tractor className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <h3 className="font-bold">Arrasto de toras</h3>
          <p className="text-xs text-muted-foreground">
            Confirme quais toras já foram arrastadas da árvore. O arrasto é contado por plaqueta.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-md border bg-background p-2">
          <p>Traçadas</p><b className="text-lg">{status.total}</b>
        </div>
        <div className="rounded-md border bg-background p-2">
          <p>Arrastadas</p><b className="text-lg">{status.arrastadas.length}</b>
        </div>
        <div className="rounded-md border bg-background p-2">
          <p>A arrastar</p><b className="text-lg">{disponiveis.length}</b>
        </div>
      </div>
      {!!pendentesFila.length && (
        <p role="status" className="flex items-center gap-1 text-xs font-medium">
          <Clock3 className="size-4" />
          {pendentesFila.length} tora(s) com arrasto registrado offline, aguardando sincronizar.
        </p>
      )}
      {!status.total ? <p className="text-sm">Nenhuma tora lançada para esta árvore. Faça o traçamento primeiro.</p> : null}
      {status.total > 0 && !bancoHabilitado && (
        <p role="status" className="text-sm font-semibold text-muted-foreground">
          Prévia do arrasto. Aguarde a migração do banco antes de registrar operações.
        </p>
      )}
      {!!status.carregadasSemArrasto.length && (
        <p className="text-xs text-muted-foreground">
          {status.carregadasSemArrasto.length} tora(s) já carregada(s) sem histórico de arrasto (lançamentos anteriores).
        </p>
      )}
      {!disponiveis.length && status.arrastadas.length > 0 && (
        <p className="flex gap-1 text-sm font-semibold">
          <CheckCircle2 className="size-5 text-primary" /> Nenhuma tora nova aguardando arrasto.
        </p>
      )}
      {disponiveis.length > 0 && (
        <>
          <div className="space-y-1">
            <p className="text-xs font-semibold">Selecione as toras arrastadas</p>
            {disponiveis.map((t) => (
              <label key={t.plaqueta} className="flex items-center gap-2 rounded-md border bg-background p-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={selecionadas.includes(t.plaqueta)}
                  onChange={(e) => setSelecionadas((cur) =>
                    e.target.checked ? [...cur, t.plaqueta] : cur.filter((n) => n !== t.plaqueta))}
                />
                <span className="min-w-0 flex-1">
                  <b>Secção {t.secao || "—"}</b> · plaqueta {t.plaqueta}
                  <span className="block text-xs text-muted-foreground">{fmtM3(Number(t.volume))} m³</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setSelecionadas(disponiveis.map((t) => t.plaqueta))}>
              Selecionar todas
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelecionadas([])}>
              Limpar
            </Button>
          </div>
          <Button type="button" className="w-full" disabled={ocupado || encerrado || !bancoHabilitado || !selecionadas.length}
            onClick={() => void registrar()}>
            {ocupado ? <LoaderCircle className="size-4 animate-spin" /> : <Tractor className="size-4" />}
            Registrar arrasto concluído ({selecionadas.length})
          </Button>
          <p className="text-xs text-muted-foreground">
            Exige GPS do tratorista próximo à árvore (até 100 m).
            Funciona offline com fila protegida; só entra nos totais da empresa após sincronizar.
          </p>
        </>
      )}
    </section>
  );
}

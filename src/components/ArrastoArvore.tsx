import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock3, LoaderCircle, Tractor } from "lucide-react";
import type { Arvore } from "@/lib/data";
import { arrastosArvoresQuery, conciliacaoArrasto, validarArrastoArvore } from "@/lib/arrasto-arvore";
import { registrarArrastoArvore } from "@/lib/arrasto-arvore-salvar";
import { assinarFila, fila } from "@/lib/offline/fila";
import { listarExplanadas } from "@/lib/explanadas";
import { Button } from "@/components/ui/button";

export function ArrastoArvore({
  arvore, empresa, encerrado,
}: {
  arvore: Arvore;
  empresa: string;
  encerrado: boolean;
}) {
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const [explanadaId, setExplanadaId] = useState("");
  const [pendente, setPendente] = useState(false);

  const chave = arrastosArvoresQuery(empresa, arvore.autex);
  const consulta = useQuery({ ...chave, enabled: !!empresa && !!arvore.autex });
  const arrasto = useMemo(() => consulta.data?.find((a) =>
    a.empresa_id === empresa && a.autex === arvore.autex && a.arvore === arvore.numero,
  ), [consulta.data, arvore.numero, arvore.autex, empresa]);
  const explanadas = useQuery({
    queryKey: ["explanadas", empresa, arvore.autex],
    queryFn: () => listarExplanadas(empresa, arvore.autex),
    enabled: !!empresa,
    networkMode: "always",
  });

  useEffect(() => {
    let ativo = true;
    async function atualizar() {
      try {
        const itens = await fila().listar();
        if (ativo) setPendente(itens.some(({ op }) =>
          op.tipo === "arrasto_arvore" && op.empresa_id === empresa &&
          op.autex === arvore.autex && op.arvore === arvore.numero));
      } catch {
        if (ativo) setPendente(false);
      }
    }
    const cancelar = assinarFila(() => { void atualizar(); });
    void atualizar();
    return () => { ativo = false; cancelar(); };
  }, [empresa, arvore.autex, arvore.numero]);

  async function confirmar() {
    if (salvando || encerrado || pendente || arrasto) return;
    if (!navigator.geolocation) {
      toast.error("Ative o GPS do aparelho para registrar o arrasto.");
      return;
    }
    setSalvando(true);
    try {
      const pos = await new Promise<GeolocationPosition>((ok, falhou) =>
        navigator.geolocation.getCurrentPosition(ok, falhou, {
          enableHighAccuracy: true, maximumAge: 0, timeout: 20000,
        }));
      const gps = {
        lat: pos.coords.latitude, lng: pos.coords.longitude,
        precisao: pos.coords.accuracy,
        capturado_em: new Date(pos.timestamp).toISOString(),
      };
      const erro = validarArrastoArvore(arvore, gps);
      if (erro) throw new Error(erro);
      const destino = explanadas.data?.find((e) => e.id === explanadaId)?.nome ?? "a definir";
      if (!window.confirm(
        "Confirmar o arrasto da ÁRVORE " + arvore.numero + "?\n\n" +
        "AUTEX: " + arvore.autex + "\nDestino: " + destino +
        "\n\nRegistre apenas depois de concluir o serviço. A operação terá GPS e data."
      )) return;
      const resultado = await registrarArrastoArvore({
        arvore, empresa, explanadaId: explanadaId || null, gps,
      });
      if (!resultado.offline) {
        await qc.invalidateQueries({ queryKey: chave.queryKey });
        await qc.invalidateQueries({ queryKey: ["toras"] });
      }
      toast.success(resultado.offline
        ? "Arrasto salvo offline neste aparelho. Será conciliado ao sincronizar."
        : "Arrasto registrado! " + (!arvore.abatida_em ? "Aguardando sincronização do abate do cortador." : "Abate já confirmado."),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o arrasto.");
    } finally {
      setSalvando(false);
    }
  }

  const estado = conciliacaoArrasto(arrasto, arvore.abatida_em);
  return (
    <section aria-label="Arrasto da árvore inteira" className="space-y-3 rounded-lg border border-primary/40 bg-secondary/40 p-3">
      <div className="flex items-start gap-2">
        <Tractor className="size-5 shrink-0 text-primary" />
        <div>
          <h3 className="font-bold">Arrasto da árvore</h3>
          <p className="text-xs text-muted-foreground">
            O tratorista pode registrar agora, mesmo que o cortador ainda não tenha sincronizado o abate.
            Não é necessário traçar as toras antes.
          </p>
        </div>
      </div>

      {pendente && (
        <p role="status" className="flex items-center gap-2 rounded-md border p-2 text-sm">
          <Clock3 className="size-4" /> Arrasto salvo offline neste aparelho, aguardando sincronização.
        </p>
      )}
      {arrasto && (
        <div role="status" className="space-y-1 rounded-md border bg-background p-3">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="size-4 text-primary" />
            Arrasto registrado em {new Date(arrasto.capturado_em).toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-muted-foreground">
            {estado === "conciliado"
              ? "Abate e arrasto conciliados."
              : "Arrasto recebido, aguardando o cortador sincronizar o abate."}
          </p>
          <p className="text-xs text-muted-foreground">
            Destino: {explanadas.data?.find((e) => e.id === arrasto.explanada_id)?.nome ?? "A definir"}
          </p>
        </div>
      )}
      {!arrasto && !pendente && !encerrado && (
        <>
          {!arvore.abatida_em && (
            <p className="rounded-md bg-background p-2 text-xs">
              O abate ainda não aparece neste aparelho. Se você confirmou a árvore em campo,
              pode registrar o arrasto; o sistema conciliará os dois lançamentos depois.
            </p>
          )}
          <label className="block text-xs font-semibold">
            Explanada de destino
            <select
              aria-label="Explanada de destino da árvore"
              className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm"
              value={explanadaId}
              onChange={(e) => setExplanadaId(e.target.value)}
            >
              <option value="">A definir depois</option>
              {(explanadas.data ?? []).map((e) =>
                <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </label>
          <Button type="button" className="h-12 w-full" disabled={salvando || arvore.latitude == null || arvore.longitude == null}
            onClick={() => void confirmar()}>
            {salvando ? <LoaderCircle className="size-4 animate-spin" /> : <Tractor className="size-4" />}
            {salvando ? "Capturando GPS..." : "Registrar arrasto da árvore"}
          </Button>
          {arvore.latitude == null || arvore.longitude == null ? (
            <p className="text-xs text-destructive">Esta árvore precisa ter coordenadas cadastradas no mapa.</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              GPS atual com precisão de até 100 m, próximo à árvore. A fila funciona sem internet,
              e o registro não será duplicado após a sincronização.
            </p>
          )}
        </>
      )}
    </section>
  );
}

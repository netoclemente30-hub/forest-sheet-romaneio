import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "./ui/button";
import { consultarEventosNfe, enviarEventoNfe } from "@/lib/spedy.functions";
import { eventoNotaSchema, type EventoSpedy, type RegistroEvento } from "@/lib/spedy-eventos.core";
type Historico = { situacao: string; eventos: EventoSpedy[]; historico: RegistroEvento[] };
function detalhe(registro: RegistroEvento) {
  try {
    const r = JSON.parse(registro.resultado ?? "{}") as {
      tipo?: string;
      texto?: string;
      protocolo?: string;
      http?: number;
    };
    return [
      r.tipo === "correcao" ? "Carta de correção" : r.tipo === "cancelamento" ? "Cancelamento" : "",
      r.texto,
      r.protocolo ? "Protocolo " + r.protocolo : "",
      r.http ? "Retorno HTTP " + r.http : "",
    ]
      .filter(Boolean)
      .join(" · ");
  } catch {
    return registro.resultado;
  }
}
const acoes: Record<string, string> = {
  evento_inicio: "Solicitação registrada",
  evento_enviado: "Solicitação recebida",
  evento_incerto: "Resultado a conferir",
  evento_rejeitado: "Solicitação recusada",
  evento_confirmado: "Evento confirmado",
};
export function EventosNfe({ empresa, rascunhoId }: { empresa: string; rascunhoId: string }) {
  const consultar = useServerFn(consultarEventosNfe);
  const enviar = useServerFn(enviarEventoNfe);
  const [historico, setHistorico] = useState<Historico | null>(null);
  const [tipo, setTipo] = useState<"cancelamento" | "correcao" | null>(null);
  const [texto, setTexto] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const trava = useRef(false);
  async function atualizar() {
    const r = await consultar({ data: { empresa, rascunhoId } });
    if (r.ok) {
      setHistorico(r);
      return true;
    }
    setMensagem(r.mensagem);
    return false;
  }
  async function carregar() {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    try {
      await atualizar();
    } catch {
      setMensagem("Não foi possível consultar os eventos. Tente novamente.");
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  function selecionar(t: "cancelamento" | "correcao") {
    setTipo(t);
    setTexto("");
    setConfirmado(false);
    setMensagem("");
  }
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">Cancelamento e carta de correção</h3>
      <p className="text-sm">
        Confira a situação e os eventos da NF-e em homologação antes de solicitar uma alteração.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={ocupado} onClick={carregar}>
          Consultar eventos fiscais
        </Button>
        <Button
          variant="destructive"
          disabled={ocupado || historico?.situacao !== "authorized"}
          onClick={() => selecionar("cancelamento")}
        >
          Cancelar NF-e
        </Button>
        <Button
          variant="outline"
          disabled={ocupado || historico?.situacao !== "authorized"}
          onClick={() => selecionar("correcao")}
        >
          Carta de correção
        </Button>
      </div>
      {historico && (
        <p>
          Situação na Spedy ·{" "}
          {historico.situacao === "authorized"
            ? "Autorizada"
            : historico.situacao === "canceled"
              ? "Cancelada"
              : historico.situacao === "evento_pendente"
                ? "Evento pendente de confirmação"
                : historico.situacao}
        </p>
      )}
      {tipo && (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (trava.current || !confirmado) return;
            const v = eventoNotaSchema.safeParse({ tipo, texto });
            if (!v.success) {
              setMensagem(v.error.issues.map((i) => i.message).join(" "));
              return;
            }
            trava.current = true;
            setOcupado(true);
            try {
              const r = await enviar({
                data: { empresa, rascunhoId, confirmacao: "HOMOLOGACAO", ...v.data },
              });
              setMensagem(r.mensagem);
              setConfirmado(false);
              if (r.ok) {
                setTipo(null);
                setTexto("");
              } else setHistorico(null);
              await atualizar();
            } catch {
              setHistorico(null);
              setMensagem(
                "Sem resposta confirmada. Consulte os eventos antes de tentar novamente.",
              );
            } finally {
              trava.current = false;
              setOcupado(false);
            }
          }}
        >
          <h4 className="font-semibold">
            {tipo === "cancelamento" ? "Solicitar cancelamento" : "Enviar carta de correção"}
          </h4>
          {tipo === "correcao" ? (
            <p className="text-sm">
              Descreva a correção completa. A CC-e deve respeitar as regras fiscais para valores,
              tributos, identificação das partes e datas da nota. Confira o texto com o responsável
              fiscal.
            </p>
          ) : (
            <p className="text-sm">
              Informe o motivo do cancelamento. A SEFAZ verificará o prazo e as condições aplicáveis
              à nota.
            </p>
          )}
          <label className="block">
            {tipo === "cancelamento"
              ? "Justificativa do cancelamento"
              : "Texto da carta de correção"}
            <textarea
              className="block w-full rounded border bg-background p-2"
              rows={4}
              required
              minLength={15}
              maxLength={tipo === "cancelamento" ? 255 : 1000}
              disabled={ocupado}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={confirmado}
              disabled={ocupado}
              onChange={(e) => setConfirmado(e.target.checked)}
            />
            Conferi a nota e confirmo o envio deste evento em homologação.
          </label>
          <div className="flex gap-2">
            <Button disabled={ocupado || !confirmado || historico?.situacao !== "authorized"}>
              {ocupado ? "Enviando…" : "Confirmar envio em homologação"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={ocupado}
              onClick={() => setTipo(null)}
            >
              Voltar
            </Button>
          </div>
        </form>
      )}
      {mensagem && <p role="status">{mensagem}</p>}
      {historico && (
        <>
          <h4 className="font-semibold">Eventos da Spedy</h4>
          {!historico.eventos.length && <p>Nenhum evento retornado.</p>}
          <ul className="space-y-2 text-sm">
            {historico.eventos.map((e) => (
              <li key={e.id} className="rounded border p-2">
                {e.tipo} · {e.data} {e.protocolo && "· Protocolo " + e.protocolo} · {e.codigo}{" "}
                {e.mensagem}
              </li>
            ))}
          </ul>
          <details>
            <summary>Histórico das solicitações no Gestor</summary>
            <ul className="space-y-2 text-sm">
              {historico.historico.map((e) => (
                <li key={e.id} className="whitespace-pre-wrap">
                  {e.criado_em} · {acoes[e.acao] ?? e.acao} · {detalhe(e)}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}

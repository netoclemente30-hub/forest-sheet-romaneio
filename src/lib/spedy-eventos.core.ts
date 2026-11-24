import { z } from "zod";
import {
  AMBIENTE_PERMITIDO,
  ErroFiscal,
  type Documento,
  type Http,
  type Store,
} from "./fiscal-spedy.core";

export const eventoNotaSchema = z
  .object({
    tipo: z.enum(["cancelamento", "correcao"]),
    texto: z.string().trim().min(15, "Informe pelo menos 15 caracteres.").max(1000),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === "cancelamento" && v.texto.length > 255)
      ctx.addIssue({ code: "custom", message: "A justificativa pode ter até 255 caracteres." });
  });
export type EventoNotaEntrada = z.infer<typeof eventoNotaSchema>;
export type RegistroEvento = {
  id: string;
  acao: string;
  resultado: string | null;
  criado_em: string;
};
export type EventoSpedy = {
  id: string;
  tipo: string;
  data: string;
  protocolo: string;
  codigo: string;
  mensagem: string;
};
export type StoreEventos = Pick<Store, "documento" | "atualizar" | "evento" | "config"> & {
  cnpj(empresa: string): Promise<string>;
  reservarEvento(doc: Documento, usuario: string): Promise<Documento | null>;
  finalizarEvento(doc: Documento, campos: Partial<Documento>): Promise<boolean>;
  historico(empresa: string, documento: string): Promise<RegistroEvento[]>;
  ultimoInicio(empresa: string, documento: string): Promise<RegistroEvento | null>;
};
type Ctx = { http: Http | null; store: StoreEventos; empresa: string; usuario: string };
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const corpo = (v: unknown) => obj(obj(v)["result"] ?? v);
const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
async function obter(ctx: Ctx, rascunho: string) {
  const doc = await ctx.store.documento(ctx.empresa, rascunho);
  if (!doc?.spedy_id || !z.string().uuid().safeParse(doc.spedy_id).success)
    throw new ErroFiscal(
      "nota_pendente",
      "A nota precisa estar registrada na Spedy para receber eventos.",
    );
  if (!ctx.http)
    throw new ErroFiscal("chave_ausente", "Configure a chave de homologação no servidor.");
  return doc;
}
async function notaRemota(ctx: Ctx, doc: Documento) {
  const r = await ctx.http!("/product-invoices/" + encodeURIComponent(doc.spedy_id!));
  if (r.status >= 300)
    throw new ErroFiscal("consulta", "Não foi possível conferir a nota na Spedy.");
  const n = corpo(r.json);
  const cnpj = digitos(await ctx.store.cnpj(ctx.empresa));
  if (
    !cnpj ||
    digitos(obj(n["company"])["federalTaxNumber"]) !== cnpj ||
    n["environmentType"] !== AMBIENTE_PERMITIDO ||
    n["id"] !== doc.spedy_id
  )
    throw new ErroFiscal(
      "escopo",
      "A nota deve pertencer à empresa selecionada e estar em homologação.",
    );
  return n;
}
async function eventosRemotos(ctx: Ctx, doc: Documento): Promise<EventoSpedy[]> {
  const r = await ctx.http!("/product-invoices/" + encodeURIComponent(doc.spedy_id!) + "/events");
  if (r.status >= 300)
    throw new ErroFiscal("consulta", "Não foi possível consultar os eventos da nota.");
  const v = obj(r.json)["result"] ?? r.json;
  if (!Array.isArray(v))
    throw new ErroFiscal("consulta", "A Spedy retornou um histórico inválido.");
  return v.map(obj).map((e) => ({
    id: String(e["id"] ?? ""),
    tipo: String(e["type"] ?? ""),
    data: String(e["date"] ?? ""),
    protocolo: String(e["protocol"] ?? ""),
    codigo: String(e["code"] ?? ""),
    mensagem: String(e["message"] ?? "").slice(0, 500),
  }));
}
export async function consultarEventosNota(ctx: Ctx, rascunho: string) {
  const doc = await obter(ctx, rascunho);
  const nota = await notaRemota(ctx, doc);
  const eventos = await eventosRemotos(ctx, doc);
  let situacao = String(nota["status"] ?? doc.status);
  if (doc.status === "evento_pendente") {
    const inicio = await ctx.store.ultimoInicio(ctx.empresa, doc.id);
    let dados: { tipo?: string; anteriores?: string[] } | null = null;
    try {
      dados = JSON.parse(inicio?.resultado ?? "null");
    } catch {
      /* Registro incompleto exige reconciliação administrativa. */
    }
    if (!inicio || !doc.tentativa_em || Date.parse(inicio.criado_em) < Date.parse(doc.tentativa_em))
      dados = null;
    const tipo =
      dados?.tipo === "cancelamento"
        ? "cancellation"
        : dados?.tipo === "correcao"
          ? "correctionLetter"
          : "";
    const confirmado =
      tipo &&
      Array.isArray(dados?.anteriores) &&
      eventos.find(
        (e) =>
          e.tipo === tipo &&
          !dados.anteriores!.includes(e.id) &&
          !!e.protocolo &&
          (tipo === "cancellation" ? ["135", "155"] : ["135"]).includes(e.codigo),
      );
    if ((dados?.tipo === "cancelamento" && situacao === "canceled") || confirmado) {
      situacao = dados?.tipo === "cancelamento" ? "canceled" : situacao;
      await ctx.store.evento({
        empresa_id: ctx.empresa,
        documento_id: doc.id,
        usuario_id: ctx.usuario,
        acao: "evento_confirmado",
        resultado: JSON.stringify({
          tipo: dados?.tipo,
          protocolo: confirmado ? confirmado.protocolo : null,
          situacao,
        }),
      });
      const finalizado = await ctx.store.finalizarEvento(doc, {
        status: situacao,
        mensagem: "Evento confirmado pela consulta à Spedy.",
      });
      if (!finalizado) situacao = "evento_pendente";
    } else situacao = "evento_pendente";
  }
  return { situacao, eventos, historico: await ctx.store.historico(ctx.empresa, doc.id) };
}
export async function enviarEventoNota(ctx: Ctx, rascunho: string, entrada: EventoNotaEntrada) {
  const v = eventoNotaSchema.safeParse(entrada);
  if (!v.success) throw new ErroFiscal("validacao", v.error.issues.map((i) => i.message).join(" "));
  const doc = await obter(ctx, rascunho);
  const n = await notaRemota(ctx, doc);
  if (doc.status === "evento_pendente")
    throw new ErroFiscal(
      "evento_pendente",
      "Já existe um evento pendente. Consulte o histórico antes de tentar outro envio.",
    );
  if (doc.status !== "authorized" || n["status"] !== "authorized")
    throw new ErroFiscal(
      "situacao",
      "Cancelamento e carta de correção exigem uma NF-e autorizada.",
    );
  const cfg = await ctx.store.config(ctx.empresa);
  const cnpj = digitos(await ctx.store.cnpj(ctx.empresa));
  if (!cfg?.spedy_company_id || digitos(cfg.cnpj) !== cnpj)
    throw new ErroFiscal("cadastro", "Confira o vínculo da empresa na Spedy.");
  const s = await ctx.http!("/companies/" + encodeURIComponent(cfg.spedy_company_id) + "/settings");
  if (
    s.status >= 300 ||
    obj(corpo(s.json)["productInvoice"])["environmentType"] !== AMBIENTE_PERMITIDO
  )
    throw new ErroFiscal("ambiente", "O modelo NF-e da empresa precisa estar em homologação.");
  const anteriores = await eventosRemotos(ctx, doc);
  const reserva = await ctx.store.reservarEvento(doc, ctx.usuario);
  if (!reserva)
    throw new ErroFiscal(
      "concorrencia",
      "Outro evento desta nota está em andamento. Consulte o histórico.",
    );
  await ctx.store.evento({
    empresa_id: ctx.empresa,
    documento_id: doc.id,
    usuario_id: ctx.usuario,
    acao: "evento_inicio",
    resultado: JSON.stringify({ ...v.data, anteriores: anteriores.map((e) => e.id) }),
  });
  let resposta;
  try {
    resposta = await ctx.http!(
      "/product-invoices/" +
        encodeURIComponent(doc.spedy_id!) +
        (v.data.tipo === "correcao" ? "/corrections" : ""),
      {
        method: v.data.tipo === "correcao" ? "POST" : "DELETE",
        body: v.data.tipo === "correcao" ? { letter: v.data.texto } : { reason: v.data.texto },
      },
    );
  } catch {
    await ctx.store.evento({
      empresa_id: ctx.empresa,
      documento_id: doc.id,
      usuario_id: ctx.usuario,
      acao: "evento_incerto",
      resultado: v.data.tipo,
    });
    return {
      situacao: "evento_pendente",
      mensagem:
        "Envio sem resposta confirmada. Consulte os eventos. O reenvio fica bloqueado para evitar duplicação.",
    };
  }
  const aceito = resposta.status >= 200 && resposta.status < 300;
  const definitivo =
    resposta.status >= 400 &&
    resposta.status < 500 &&
    ![408, 409, 425, 429].includes(resposta.status);
  await ctx.store.evento({
    empresa_id: ctx.empresa,
    documento_id: doc.id,
    usuario_id: ctx.usuario,
    acao: aceito ? "evento_enviado" : definitivo ? "evento_rejeitado" : "evento_incerto",
    resultado: JSON.stringify({ tipo: v.data.tipo, http: resposta.status }),
  });
  if (definitivo)
    await ctx.store.finalizarEvento(reserva, {
      status: "authorized",
      mensagem:
        "A Spedy recusou o evento. Confira o texto e a situação fiscal antes de tentar novamente.",
    });
  return {
    situacao: definitivo ? "authorized" : "evento_pendente",
    mensagem: aceito
      ? "Solicitação recebida pela Spedy. Consulte os eventos para confirmar protocolo e resultado."
      : definitivo
        ? "A Spedy recusou a solicitação. Confira as regras e o texto informado."
        : "Resultado incerto. Consulte os eventos antes de qualquer novo envio.",
  };
}

import { describe, it, expect, vi } from "vitest";
import {
  enviarEventoNota,
  consultarEventosNota,
  type StoreEventos,
  type RegistroEvento,
} from "./spedy-eventos.core";
import { consultarNota, emitirNota, type Documento, type Store } from "./fiscal-spedy.core";
const notaId = "11111111-2222-4333-8444-555555555555";
function fixture(
  opcoes: {
    status?: string;
    cnpj?: string;
    ambiente?: string;
    resposta?: number;
    timeout?: boolean;
    falhaAuditoria?: boolean;
  } = {},
) {
  const doc: Documento = {
    id: "doc",
    empresa_id: "empresa-a",
    rascunho_id: "R1",
    status: opcoes.status ?? "authorized",
    spedy_id: notaId,
    payload_hash: null,
    numero: "1",
    serie: "1",
    chave_acesso: null,
    protocolo: null,
    mensagem: null,
    tentativa_em: null,
  };
  const registros: RegistroEvento[] = [];
  let remotos: unknown[] = [];
  const store: StoreEventos = {
    config: async () => ({ spedy_company_id: "empresa-spedy", cnpj: "11222333000181" }),
    cnpj: async () => "11222333000181",
    documento: async (empresa) => (empresa === doc.empresa_id ? { ...doc } : null),
    reservarEvento: async () => {
      if (doc.status !== "authorized") return null;
      doc.status = "evento_pendente";
      doc.tentativa_em = new Date().toISOString();
      return { ...doc };
    },
    finalizarEvento: async (reserva, campos) => {
      if (doc.status !== "evento_pendente" || doc.tentativa_em !== reserva.tentativa_em)
        return false;
      Object.assign(doc, campos);
      return true;
    },
    evento: async (e) => {
      if (opcoes.falhaAuditoria) throw new Error("Banco indisponível");
      registros.unshift({
        id: String(registros.length),
        acao: e.acao,
        resultado: e.resultado,
        criado_em: new Date().toISOString(),
      });
    },
    historico: async () => registros,
    ultimoInicio: async () => registros.find((e) => e.acao === "evento_inicio") ?? null,
  };
  const http = vi.fn(async (caminho: string, init?: { method?: string; body?: unknown }) => {
    if (init?.method) {
      if (opcoes.timeout) throw new Error("timeout");
      return { status: opcoes.resposta ?? 200, json: { letter: "Correção recebida" } };
    }
    if (caminho.endsWith("/settings"))
      return {
        status: 200,
        json: { productInvoice: { environmentType: opcoes.ambiente ?? "development" } },
      };
    if (caminho.endsWith("/events")) return { status: 200, json: remotos };
    return {
      status: 200,
      json: {
        id: notaId,
        status: opcoes.status ?? "authorized",
        environmentType: opcoes.ambiente ?? "development",
        company: { federalTaxNumber: opcoes.cnpj ?? "11222333000181" },
      },
    };
  });
  const ctx = { http, store, empresa: "empresa-a", usuario: "operador" };
  return {
    ctx,
    http,
    doc,
    registros,
    setEventos: (v: unknown[]) => {
      remotos = v;
    },
  };
}
const entrada = {
  tipo: "correcao" as const,
  texto: "Corrigir a descrição complementar do transporte.",
};
describe("eventos de NF-e", () => {
  it.each(["cancelamento", "correcao"] as const)(
    "envia %s com contrato correto e auditoria anterior ao HTTP",
    async (tipo) => {
      const f = fixture();
      await enviarEventoNota(f.ctx, "R1", { ...entrada, tipo });
      const envio = f.http.mock.calls.find((c) => c[1]?.method);
      expect(envio).toEqual([
        "/product-invoices/" + notaId + (tipo === "correcao" ? "/corrections" : ""),
        {
          method: tipo === "correcao" ? "POST" : "DELETE",
          body: tipo === "correcao" ? { letter: entrada.texto } : { reason: entrada.texto },
        },
      ]);
      expect(f.doc.status).toBe("evento_pendente");
      expect(
        f.registros.some((r) => r.acao === "evento_inicio" && r.resultado?.includes(entrada.texto)),
      ).toBe(true);
    },
  );
  it.each([
    { status: "canceled" },
    { status: "rejected" },
    { cnpj: "99999999000199" },
    { ambiente: "production" },
  ])("bloqueia nota incompatível %j antes da mutação", async (opcoes) => {
    const f = fixture(opcoes);
    await expect(enviarEventoNota(f.ctx, "R1", entrada)).rejects.toThrow();
    expect(f.http.mock.calls.some((c) => c[1]?.method)).toBe(false);
  });
  it("exige empresa vinculada e texto válido", async () => {
    const f = fixture();
    await expect(
      enviarEventoNota({ ...f.ctx, empresa: "empresa-b" }, "R1", entrada),
    ).rejects.toThrow();
    await expect(enviarEventoNota(f.ctx, "R1", { ...entrada, texto: "curto" })).rejects.toThrow();
    expect(f.http).not.toHaveBeenCalled();
  });
  it("concorre com um único envio e mantém trava após timeout", async () => {
    const f = fixture({ timeout: true });
    const resultados = await Promise.allSettled([
      enviarEventoNota(f.ctx, "R1", entrada),
      enviarEventoNota(f.ctx, "R1", entrada),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(f.http.mock.calls.filter((c) => c[1]?.method)).toHaveLength(1);
    await expect(enviarEventoNota(f.ctx, "R1", entrada)).rejects.toThrow(/pendente/);
    expect(f.doc.status).toBe("evento_pendente");
  });
  it("falha de auditoria impede envio e conserva trava", async () => {
    const f = fixture({ falhaAuditoria: true });
    await expect(enviarEventoNota(f.ctx, "R1", entrada)).rejects.toThrow();
    expect(f.http.mock.calls.some((c) => c[1]?.method)).toBe(false);
    expect(f.doc.status).toBe("evento_pendente");
  });
  it("confirma somente novo evento com protocolo e código aceito", async () => {
    const f = fixture();
    await enviarEventoNota(f.ctx, "R1", entrada);
    f.setEventos([{ id: "evento-novo", type: "correctionLetter", protocol: "P1", code: "136" }]);
    expect((await consultarEventosNota(f.ctx, "R1")).situacao).toBe("evento_pendente");
    f.setEventos([{ id: "evento-novo", type: "correctionLetter", protocol: "P1", code: "135" }]);
    expect((await consultarEventosNota(f.ctx, "R1")).situacao).toBe("authorized");
    expect(f.registros[0]?.acao).toBe("evento_confirmado");
  });
  it("histórico antigo não resolve uma nova solicitação", async () => {
    const f = fixture();
    f.setEventos([{ id: "antigo", type: "correctionLetter", protocol: "P0", code: "135" }]);
    await enviarEventoNota(f.ctx, "R1", entrada);
    expect((await consultarEventosNota(f.ctx, "R1")).situacao).toBe("evento_pendente");
  });
  it("consulta normal preserva evento pendente", async () => {
    const f = fixture({ status: "evento_pendente" });
    const r = await consultarNota({ ...f.ctx, store: f.ctx.store as unknown as Store }, "R1");
    expect(r.situacao).toBe("evento_pendente");
    expect(f.http).not.toHaveBeenCalled();
  });
  it("libera nova tentativa somente após rejeição HTTP definitiva", async () => {
    const recusado = fixture({ resposta: 400 }),
      incerto = fixture({ resposta: 503 });
    expect((await enviarEventoNota(recusado.ctx, "R1", entrada)).situacao).toBe("authorized");
    expect((await enviarEventoNota(incerto.ctx, "R1", entrada)).situacao).toBe("evento_pendente");
  });
});

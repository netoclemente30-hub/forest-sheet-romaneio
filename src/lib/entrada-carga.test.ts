import { describe, expect, it } from "vitest";
import { conferirCargaQr, recebimentoPendente, romaneiosComFila } from "./tora-origem";
import { secaoDaRota } from "./nav";
import { rotaPermitida, pode } from "./funcoes";
import type { ItemFila } from "./offline/fila";
import type { Romaneio } from "./data";

const log = { acao: "Entrada no pátio", detalhe: "", user_email: "a@b", lat: null, lng: null, criado_em: "2026-11-15T10:00:00.000Z", operacao_id: "op-1" };
const filaRecebida: ItemFila[] = [{ id: "i1", criadoEm: 1, op: { tipo: "romaneio_recebido", id: "rom-1", patio: "Pátio 1", empresa_id: "emp-a", log } }];
const rom = { id: "rom-1", empresa_id: "emp-a", recebido_em: null, patio: null } as unknown as Romaneio;

describe("Entrada no pátio pertence à Serraria", () => {
  it("classifica /entrada como Serraria e não Manejo", () => {
    expect(secaoDaRota("/entrada")).toBe("serraria");
    expect(secaoDaRota("/romaneio")).toBe("manejo");
  });
  it("gerente de pátio consulta histórico de cargas na Serraria", () => {
    expect(rotaPermitida("gerente_patio", "/historico")).toBe(true);
    expect(secaoDaRota("/historico/abc", "gerente_patio")).toBe("serraria");
    expect(secaoDaRota("/historico/abc", "motorista")).toBe("manejo");
  });
  it("motorista não recebe carga", () => {
    expect(rotaPermitida("motorista", "/entrada")).toBe(false);
    expect(pode("motorista", "serraria_operar")).toBe(false);
  });
});

describe("conferência do QR da carga", () => {
  const toras = [{ plaqueta: 2, empresa_id: "emp-a" }, { plaqueta: 1, empresa_id: "emp-a" }];
  it("aceita exatamente as toras da carga", () => {
    expect(conferirCargaQr([1, 2], rom, toras, "emp-a")).toEqual({ ok: true });
  });
  it("recusa carga de outra empresa", () => {
    expect(conferirCargaQr([1, 2], rom, toras, "emp-b").ok).toBe(false);
  });
  it("recusa QR com toras diferentes da carga", () => {
    expect(conferirCargaQr([1, 2, 3], rom, toras, "emp-a").ok).toBe(false);
    expect(conferirCargaQr([1], rom, toras, "emp-a").ok).toBe(false);
  });
});

describe("recebimento offline", () => {
  it("aparece localmente como recebido sem duplicar a carga", () => {
    const lista = romaneiosComFila([rom], filaRecebida, "emp-a");
    expect(lista).toHaveLength(1);
    expect(lista[0]?.recebido_em).toBe(log.criado_em);
    expect(lista[0]?.patio).toBe("Pátio 1");
  });
  it("não projeta recebimento de outra empresa", () => {
    expect(recebimentoPendente(filaRecebida, "rom-1", "emp-b")).toBeNull();
  });
  it("detecta entrada já enfileirada para bloquear segunda entrada", () => {
    expect(recebimentoPendente(filaRecebida, "rom-1", "emp-a")?.patio).toBe("Pátio 1");
  });
  it("não mostra como recebida uma entrada com erro", () => {
    const comErro = [{ ...filaRecebida[0]!, erro: "Esta carga já foi recebida" }];
    expect(romaneiosComFila([rom], comErro, "emp-a")[0]?.recebido_em).toBeNull();
  });
});

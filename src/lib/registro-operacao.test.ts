import { beforeEach, expect, it, vi } from "vitest";
import { registrarOperacao } from "./registro-operacao";
import { salvarEncaixe, type SalvarEncaixeDeps } from "./encaixe-salvar";
import { executarOp } from "./offline/sync";
import type { LogCapturado } from "./registro";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
const log: LogCapturado = { acao: "Encaixe confirmado", criado_em: "2026-11-16T14:43:00Z", user_email: null, lat: null, lng: null, operacao_id: "operacao-estavel" };
const linha = { arvore: 48, secao: "", autex: "AUTESP-2011.E.2026.00115", especie: "Abiurana", nome_cientifico: "Pouteria macrophylla", volume: 2 };
const medidas = { d_topo1: "73", d_topo2: "68", d_pe1: "67", d_pe2: "62", comprimento: "7,6" };
const permitidos = ["plaqueta", "arvore", "secao", "especie", "nome_cientifico", "autex", "volume", "d_topo1", "d_topo2", "d_pe1", "d_pe2", "comprimento", "origem", "carregada", "empresa_id"];

beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (_nome, args) => ({ data: "registro", error: Object.keys(args._dados).some((k) => !permitidos.includes(k)) ? { message: "Campo não permitido ao lançar tora" } : null }));
});

it("envia encaixe online sem campos gerados pelo banco, preservando medidas e secção vazia", async () => {
  const deps: SalvarEncaixeDeps = { listarFila: async () => [], online: () => true, lerInventario: async () => [], capturar: async () => log, gravarLog: async () => {}, enfileirar: vi.fn(), inserir: async (t, l) => { await registrarOperacao("tora_insert", "RJ", t, [], l); } };
  const tora = await salvarEncaixe(linha, medidas, "RJ", [], deps);
  expect(rpc).toHaveBeenCalledWith("registrar_operacao", expect.objectContaining({ _empresa: "RJ", _operacao: "operacao-estavel", _dados: { plaqueta: 1, arvore: 48, secao: null, autex: linha.autex, especie: linha.especie, nome_cientifico: linha.nome_cientifico, volume: 2.725, d_topo1: 73, d_topo2: 68, d_pe1: 67, d_pe2: 62, comprimento: 7.6, origem: "serraria", carregada: false, empresa_id: "RJ" } }));
  expect(tora.created_at).toBe(log.criado_em);
  expect(tora.romaneio_id).toBeNull();
});

it("reenvia encaixe antigo da fila sem mudar dados locais, auditoria ou id de retry", async () => {
  const dados = { empresa_id: "RJ", arvore: 48, secao: null, origem: "serraria", created_at: log.criado_em, romaneio_id: null, serrada_em: null, etiqueta_impressa_em: null, volume: 2.725 };
  await executarOp({ tipo: "tora_insert", dados, log }, "id-da-fila");
  expect(rpc).toHaveBeenCalledWith("registrar_operacao", expect.objectContaining({ _operacao: "id-da-fila", _log: log, _dados: { empresa_id: "RJ", arvore: 48, secao: null, origem: "serraria", volume: 2.725 } }));
  expect(dados.created_at).toBe(log.criado_em);
  expect(Object.keys(dados)).toContain("etiqueta_impressa_em");
});

it("não remove campos desconhecidos para contornar a rejeição do servidor", async () => {
  await expect(registrarOperacao("tora_insert", "RJ", { campo_invalido: true }, [], log)).rejects.toThrow("Campo não permitido ao lançar tora");
});
import { describe, expect, it, vi } from "vitest";
import { marcarAguardandoImpressa, editarAguardando, type MarcaImpressaDeps } from "./toras-aguardando-salvar";
import type { ItemFila, Op } from "./offline/fila";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/registro", () => ({ capturarLog: vi.fn(), gravarRegistro: vi.fn() }));
vi.mock("@/lib/offline/sync", () => ({ estaOnline: () => false }));

const tora = { id: "t1", empresa_id: "RJ", numero: 3, especie: "Ipê" };
const inserir = (dados: Record<string, unknown>): ItemFila => ({ id: "f1", criadoEm: 1, op: { tipo: "aguardando_insert", dados, log: { acao: "x", detalhe: "y", criado_em: "2026-11-12T10:00:00Z", user_email: null, lat: null, lng: null } } });
const deps = (): MarcaImpressaDeps => ({
  listarFila: vi.fn().mockResolvedValue([]),
  online: vi.fn().mockReturnValue(false),
  capturar: vi.fn().mockResolvedValue({ acao: "a", detalhe: "d", criado_em: "2026-11-12T10:00:00Z", user_email: null, lat: null, lng: null }),
  gravarLog: vi.fn().mockResolvedValue(undefined),
  gravar: vi.fn().mockResolvedValue(undefined),
  reescrever: vi.fn().mockResolvedValue(undefined),
  enfileirar: vi.fn().mockResolvedValue(undefined),
});

describe("marcar etiqueta de tora não identificada", () => {
  it("sem internet e ainda na fila: a marcação vai junto com o lançamento, sem criar outro", async () => {
    const d = deps();
    const fila = [inserir({ id: "t1", empresa_id: "RJ", numero: 3, especie: "Ipê" })];
    d.listarFila = vi.fn().mockResolvedValue(fila);
    const r = await marcarAguardandoImpressa([tora], true, d);
    expect(r).toEqual({ offline: 0 });
    expect(d.reescrever).toHaveBeenCalledWith("f1", expect.objectContaining({
      tipo: "aguardando_insert",
      dados: expect.objectContaining({ id: "t1", etiqueta_impressa: true }),
    }));
    expect(d.enfileirar).not.toHaveBeenCalled();
    expect(d.gravar).not.toHaveBeenCalled();
  });

  it("sem internet e já enviada: enfileira a marcação com a auditoria do momento", async () => {
    const d = deps();
    const r = await marcarAguardandoImpressa([tora], true, d);
    expect(r).toEqual({ offline: 1 });
    expect(d.enfileirar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "aguardando_impressa", id: "t1", empresa_id: "RJ", imprimiu: true, log: expect.objectContaining({ criado_em: "2026-11-12T10:00:00Z" }) }));
    expect(d.gravar).not.toHaveBeenCalled();
  });

  it("com internet: grava na hora e registra quem marcou", async () => {
    const d = deps();
    d.online = vi.fn().mockReturnValue(true);
    const r = await marcarAguardandoImpressa([tora, { id: "t2", empresa_id: "RJ", numero: 4, especie: "Maçaranduba" }], true, d);
    expect(r).toEqual({ offline: 0 });
    expect(d.gravar).toHaveBeenCalledTimes(2);
    expect(d.gravar).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), true, expect.any(String));
    expect(d.gravarLog).toHaveBeenCalledTimes(1);
    expect(d.enfileirar).not.toHaveBeenCalled();
  });

  it("desmarcar grava falsa e apaga a data", async () => {
    const d = deps();
    d.online = vi.fn().mockReturnValue(true);
    await marcarAguardandoImpressa([tora], false, d);
    expect(d.gravar).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), false, null);
  });

  it("desmarcar na fila mantém o mesmo lançamento e a mesma data", async () => {
    const d = deps();
    const fila = [inserir({ id: "t1", empresa_id: "RJ", numero: 3, especie: "Ipê", etiqueta_impressa: true, etiqueta_impressa_em: "2026-11-12T10:00:00Z" })];
    d.listarFila = vi.fn().mockResolvedValue(fila);
    await marcarAguardandoImpressa([tora], false, d);
    const op = (d.reescrever as unknown as { mock: { calls: [string, Op][] } }).mock.calls[0]![1];
    expect(op).toMatchObject({ tipo: "aguardando_insert", dados: { etiqueta_impressa: false, etiqueta_impressa_em: null } });
  });

  it("ignora toras sem identidade e não toca na fila", async () => {
    const d = deps();
    const r = await marcarAguardandoImpressa([{ id: "", empresa_id: "RJ", numero: 1, especie: "Ipê" }], true, d);
    expect(r).toEqual({ offline: 0 });
    expect(d.listarFila).not.toHaveBeenCalled();
    expect(d.enfileirar).not.toHaveBeenCalled();
  });
});

describe("editar tora não identificada", () => {
  const novos = { especie: "Cumaru", nome_cientifico: "Dipteryx odorata", d_topo1: 50, d_topo2: 48, d_pe1: 60, d_pe2: 58, comprimento: 5, volume: 1.15 };
  const dEd = () => { const { gravar: _g, ...b } = deps(); return { ...b, atualizar: vi.fn().mockResolvedValue(undefined) }; };

  it("online: atualiza pelo id e empresa, registra auditoria e não enfileira", async () => {
    const d = dEd(); d.online = vi.fn().mockReturnValue(true);
    expect(await editarAguardando(tora, novos, "NI-3", d)).toEqual({ offline: false });
    expect(d.atualizar).toHaveBeenCalledWith(tora, novos);
    expect(d.gravarLog).toHaveBeenCalledTimes(1);
    expect(d.enfileirar).not.toHaveBeenCalled();
  });

  it("lançamento ainda na fila: corrige o próprio item mantendo id, número, empresa e log", async () => {
    const d = dEd();
    const item = inserir({ id: "t1", empresa_id: "RJ", numero: 3, especie: "Ipê", etiqueta_impressa: true });
    d.listarFila = vi.fn().mockResolvedValue([item]);
    await editarAguardando(tora, novos, "NI-3", d);
    expect(d.reescrever).toHaveBeenCalledWith("f1", { ...item.op, dados: { id: "t1", empresa_id: "RJ", numero: 3, etiqueta_impressa: true, ...novos } });
    expect(d.enfileirar).not.toHaveBeenCalled();
    expect(d.atualizar).not.toHaveBeenCalled();
  });

  it("offline e já enviada: enfileira uma edição com id e empresa, sem novo lançamento", async () => {
    const d = dEd();
    expect(await editarAguardando(tora, novos, "NI-3", d)).toEqual({ offline: true });
    expect(d.enfileirar).toHaveBeenCalledTimes(1);
    expect(d.enfileirar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "aguardando_update", id: "t1", empresa_id: "RJ", dados: { ...novos, numero: 3 } }));
  });

  it("falha online não grava auditoria nem fila", async () => {
    const d = dEd(); d.online = vi.fn().mockReturnValue(true); d.atualizar = vi.fn().mockRejectedValue(new Error("RLS"));
    await expect(editarAguardando(tora, novos, "NI-3", d)).rejects.toThrow("RLS");
    expect(d.gravarLog).not.toHaveBeenCalled(); expect(d.enfileirar).not.toHaveBeenCalled();
  });
});

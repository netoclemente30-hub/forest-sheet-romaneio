import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { arvoreColetada, dapPorCap } from "./coleta";
import { abrirRascunhos } from "./rascunhos";

const escopo = { usuarioId: "u1", escritorioId: "e1", projetoId: "p1" };
const arvore = { numero: "1", especie: "Espécie de teste", dapCm: 35 };

describe("coleta do engenheiro", () => {
  it("persiste após reabrir, atualiza sem duplicar e separa usuário/escritório/projeto", async () => {
    const factory = new IDBFactory();
    let store = await abrirRascunhos(factory);
    await store.salvar(escopo, arvore);
    await store.salvar(escopo, { ...arvore, dapCm: 36 });
    store.fechar();
    store = await abrirRascunhos(factory);
    expect(await store.listar(escopo)).toEqual([{ ...arvore, dapCm: 36 }]);
    for (const campo of ["usuarioId", "escritorioId", "projetoId"]) {
      expect(await store.listar({ ...escopo, [campo]: "outro" })).toEqual([]);
    }
    store.fechar();
  });
  it("não grava dados inválidos ou sem escopo", async () => {
    const store = await abrirRascunhos(new IDBFactory());
    await expect(store.salvar(escopo, { ...arvore, dapCm: NaN })).rejects.toThrow();
    await expect(store.salvar({ ...escopo, usuarioId: "" }, arvore)).rejects.toThrow();
    expect(await store.listar(escopo)).toEqual([]);
    store.fechar();
  });
  it("exige coordenadas pareadas e valores finitos e não inventa altura", () => {
    expect(arvoreColetada.safeParse({ ...arvore, latitude: 0 }).success).toBe(false);
    expect(arvoreColetada.safeParse({ ...arvore, latitude: 91, longitude: 0 }).success).toBe(false);
    expect(arvoreColetada.safeParse({ ...arvore, alturaComercialM: -1 }).success).toBe(false);
    expect(arvoreColetada.parse(arvore).alturaComercialM).toBeUndefined();
    expect(dapPorCap(Math.PI * 40)).toBeCloseTo(40, 10);
    expect(() => dapPorCap(Infinity)).toThrow();
  });
});

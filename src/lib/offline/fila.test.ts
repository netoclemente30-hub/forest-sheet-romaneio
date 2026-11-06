import { describe, expect, it } from "vitest";
import { criarFila, type FilaStore, type ItemFila, type Op } from "./fila";
import { sincronizar } from "./sync";

function memoria(): FilaStore & { itens: Map<string, ItemFila> } {
  const itens = new Map<string, ItemFila>();
  return {
    itens,
    all: async () => [...itens.values()],
    put: async (i) => void itens.set(i.id, i),
    del: async (id) => void itens.delete(id),
  };
}

const opTora = (plaqueta: number): Op => ({ tipo: "tora_insert", dados: { plaqueta } });

describe("fila offline", () => {
  it("enfileira e lista na ordem de criação", async () => {
    const f = criarFila(memoria());
    const a = await f.enfileirar(opTora(1));
    const b = await f.enfileirar(opTora(2));
    const lista = await f.listar();
    expect(lista.map((i) => i.id)).toEqual([a.id, b.id]);
  });

  it("remove item após envio", async () => {
    const f = criarFila(memoria());
    const a = await f.enfileirar(opTora(1));
    await f.remover(a.id);
    expect(await f.listar()).toHaveLength(0);
  });

  it("marca erro sem perder o item", async () => {
    const f = criarFila(memoria());
    const a = await f.enfileirar(opTora(1));
    await f.marcarErro(a.id, "plaqueta duplicada");
    const [item] = await f.listar();
    expect(item.erro).toBe("plaqueta duplicada");
  });
});

describe("sincronizar", () => {
  it("envia tudo na ordem e esvazia a fila", async () => {
    const f = criarFila(memoria());
    await f.enfileirar(opTora(1));
    await f.enfileirar(opTora(2));
    const enviadas: number[] = [];
    const r = await sincronizar(f, async (op) => {
      if (op.tipo === "tora_insert") enviadas.push(op.dados.plaqueta as number);
    });
    expect(r).toEqual({ enviados: 2, erros: 0 });
    expect(enviadas).toEqual([1, 2]);
    expect(await f.listar()).toHaveLength(0);
  });

  it("marca conflito como erro e segue para os próximos", async () => {
    const f = criarFila(memoria());
    await f.enfileirar(opTora(1));
    await f.enfileirar(opTora(2));
    const r = await sincronizar(f, async (op) => {
      if (op.tipo === "tora_insert" && op.dados.plaqueta === 1) throw new Error("duplicate key");
    });
    expect(r).toEqual({ enviados: 1, erros: 1 });
    const restantes = await f.listar();
    expect(restantes).toHaveLength(1);
    expect(restantes[0].erro).toBe("duplicate key");
  });

  it("para na falha de rede sem marcar erro", async () => {
    const f = criarFila(memoria());
    await f.enfileirar(opTora(1));
    await f.enfileirar(opTora(2));
    const r = await sincronizar(f, async () => {
      throw new Error("Failed to fetch");
    });
    expect(r).toEqual({ enviados: 0, erros: 0 });
    const restantes = await f.listar();
    expect(restantes).toHaveLength(2);
    expect(restantes[0].erro).toBeUndefined();
  });
});

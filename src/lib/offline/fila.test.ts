import { describe, expect, it } from "vitest";
import { criarFila, pertenceAoUsuario, type FilaStore, type ItemFila, type Op } from "./fila";
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
    expect(item?.erro).toBe("plaqueta duplicada");
  });
  it("edita o lançamento com erro no mesmo lugar e só envia após tentar de novo", async () => {
    const f = criarFila(memoria());
    const a = await f.enfileirar(opTora(1861));
    await f.marcarErro(a.id, "plaqueta duplicada");
    await f.editarErro(a.id, opTora(1862));
    const [item] = await f.listar();
    expect(item).toEqual({ ...a, op: opTora(1862), erro: "plaqueta duplicada" });
    const enviadas: Op[] = [];
    await sincronizar(f, async (op) => { enviadas.push(op); });
    expect(enviadas).toHaveLength(0);
    await f.limparErro(a.id);
    await sincronizar(f, async (op) => { enviadas.push(op); });
    expect(enviadas).toEqual([opTora(1862)]);
    expect(await f.listar()).toHaveLength(0);
  });
  it("não recria um lançamento removido durante a edição", async () => {
    const f = criarFila(memoria());
    const a = await f.enfileirar(opTora(1));
    await f.marcarErro(a.id, "erro");
    await f.remover(a.id);
    await expect(f.editarErro(a.id, opTora(2))).rejects.toThrow("não está mais disponível");
    expect(await f.listar()).toHaveLength(0);
  });
});

it('resposta perdida após commit remoto reenvia o mesmo ID sem duplicar', async () => {
  const f = criarFila(memoria());
  const item = await f.enfileirar(opTora(7));
  const commits = new Set<string>();
  let perdeu = true;
  const enviar = async (_op: Op, id?: string) => {
    if (id) commits.add(id);
    if (perdeu) { perdeu = false; throw new Error('Network response lost'); }
  };
  await sincronizar(f, enviar);
  expect((await f.listar())[0]?.id).toBe(item.id);
  await sincronizar(f, enviar);
  expect([...commits]).toEqual([item.id]);
  expect(await f.listar()).toHaveLength(0);
});

it('edição não reescreve uma intenção cujo envio pode ter sido confirmado', async () => {
  const f = criarFila(memoria());
  const item = await f.enfileirar(opTora(7));
  await sincronizar(f, async () => { throw new Error('Network response lost'); });
  await expect(f.substituir(item.id, opTora(8))).rejects.toThrow('envio iniciado');
  expect((await f.listar())[0]?.op).toEqual(opTora(7));
});

describe("sincronizar", () => {
  it("envia tudo na ordem e esvazia a fila", async () => {
    const f = criarFila(memoria());
    await f.enfileirar(opTora(1));
    await f.enfileirar(opTora(2));
    const enviadas: number[] = [];
    const r = await sincronizar(f, async (op) => {
      if (op.tipo === "tora_insert") enviadas.push(op.dados["plaqueta"] as number);
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
      if (op.tipo === "tora_insert" && op.dados["plaqueta"] === 1) throw new Error("duplicate key");
    });
    expect(r).toEqual({ enviados: 1, erros: 1 });
    const restantes = await f.listar();
    expect(restantes).toHaveLength(1);
    expect(restantes[0]?.erro).toBe("duplicate key");
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
    expect(restantes[0]?.erro).toBeUndefined();
  });
});

describe("isolamento da fila no mesmo dispositivo", () => {
  it("oculta pendências de outra conta e preserva as próprias", () => {
    const item = { id: "id", criadoEm: 0, op: opTora(10), usuario_id: "usuario-a" };
    expect(pertenceAoUsuario(item, { id: "usuario-a", email: "a@teste.com" })).toBe(true);
    expect(pertenceAoUsuario(item, { id: "usuario-b", email: "b@teste.com" })).toBe(false);
  });
  it("só recupera pendência legada quando o email coincide", () => {
    const item = {
      id: "id", criadoEm: 0,
      op: { tipo: "tora_delete", plaqueta: 12, empresa_id: "emp", log: {
        acao: "Tora excluída", detalhe: "12", user_email: "a@teste.com",
        lat: null, lng: null, criado_em: new Date().toISOString(),
      } },
    } as ItemFila;
    expect(pertenceAoUsuario(item, { id: "usuario-a", email: "a@teste.com" })).toBe(true);
    expect(pertenceAoUsuario(item, { id: "usuario-b", email: "b@teste.com" })).toBe(false);
  });
});


it("preserva a fila após timeout mesmo quando o navegador indica conexão", async () => {
  const f = criarFila(memoria());
  await f.enfileirar(opTora(1));
  await f.enfileirar(opTora(2));
  const r = await sincronizar(f, async () => { throw new Error("Request timeout"); });
  expect(r).toEqual({ enviados: 0, erros: 0 });
  expect((await f.listar()).every(i => !i.erro)).toBe(true);
  expect(await f.listar()).toHaveLength(2);
});

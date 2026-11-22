import { describe, expect, it, vi } from "vitest";
import { criarFila, pertenceAoContexto, pertenceAoUsuario, type FilaStore, type ItemFila, type Op } from "./fila";
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
    expect(item).toEqual({ ...a, op: opTora(1862), erro: "plaqueta duplicada", estado: "erro" });
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

it('não notifica salvo quando persistência falha por quota', async () => {
  const store = memoria(); store.put = async () => { throw new DOMException('Quota', 'QuotaExceededError'); };
  const avisar = vi.fn(); const f = criarFila(store, avisar);
  await expect(f.enfileirar(opTora(39))).rejects.toThrow('Quota');
  expect(avisar).not.toHaveBeenCalled();
  expect(await f.listar()).toEqual([]);
});
it('não envia com Wi-Fi ativo mas backend inacessível', async () => {
  const f = criarFila(memoria()); await f.enfileirar(opTora(39));
  const enviar = vi.fn();
  expect(await sincronizar(f, enviar, async () => false)).toEqual({ enviados: 0, erros: 0 });
  expect(enviar).not.toHaveBeenCalled(); expect(await f.listar()).toHaveLength(1);
});
it('resposta perdida retenta o mesmo ID e não permite reescrever payload', async () => {
  const f = criarFila(memoria()); const item = await f.enfileirar(opTora(39));
  const ids: (string | undefined)[] = [];
  await sincronizar(f, async (_op, id) => { ids.push(id); throw new Error('Failed to fetch'); });
  await expect(f.substituir(item.id, opTora(422))).rejects.toThrow('Envio sem confirmação');
  await sincronizar(f, async (_op, id) => { ids.push(id); });
  expect(ids).toEqual([item.id, item.id]); expect(await f.listar()).toEqual([]);
});
it('rollback confirmado libera correção mantendo ID empresa e auditoria', async () => {
  const f = criarFila(memoria());
  const log = { acao: 'Tora lançada', detalhe: '39A', user_email: 'operador@teste.com', lat: -10, lng: -63, criado_em: '2026-11-22T10:00:00Z' };
  const original: Op = { tipo: 'tora_insert', dados: { empresa_id: 'RJ', plaqueta: 39 }, log };
  const item = await f.enfileirar(original);
  await sincronizar(f, async () => { throw Object.assign(new Error('duplicate key'), { code: '23505' }); });
  await f.editarErro(item.id, { ...original, dados: { empresa_id: 'RJ', plaqueta: 422 }, log: { ...log, criado_em: '2026-11-23T10:00:00Z' } });
  expect((await f.listar())[0]).toMatchObject({ id: item.id, erro: 'duplicate key', envio_iniciado: false, op: { log, dados: { empresa_id: 'RJ', plaqueta: 422 } } });
  await expect(f.editarErro(item.id, { ...original, dados: { empresa_id: 'OUTRA', plaqueta: 39 } })).rejects.toThrow('trocar a empresa');
});
it('falha na limpeza após confirmação não reenvia operação enviada', async () => {
  const store = memoria(); store.del = async () => { throw new Error('disco'); };
  const f = criarFila(store); const item = await f.enfileirar(opTora(39));
  const enviar = vi.fn().mockResolvedValue(undefined);
  await sincronizar(f, enviar); await sincronizar(f, enviar);
  expect(enviar).toHaveBeenCalledTimes(1); expect(store.itens.get(item.id)?.estado).toBe('enviado');
});
it('dois pedidos de sincronização simultâneos não enviam a mesma entrada duas vezes', async () => {
  const f = criarFila(memoria()); await f.enfileirar(opTora(39));
  let liberar: (() => void) | undefined;
  const enviar = vi.fn(() => new Promise<void>(resolve => { liberar = resolve; }));
  const primeira = sincronizar(f, enviar);
  await vi.waitFor(() => expect(enviar).toHaveBeenCalledTimes(1));
  expect(await sincronizar(f, enviar)).toEqual({ enviados: 0, erros: 0 });
  liberar?.(); await primeira; expect(enviar).toHaveBeenCalledTimes(1);
});

it('fila isola conta e empresa e não revela entradas sem empresa selecionada', () => {
  const item: ItemFila = { id: '39', criadoEm: 1, usuario_id: 'user-rj', op: { tipo: 'tora_insert', dados: { empresa_id: 'RJ', plaqueta: 39 } } };
  expect(pertenceAoContexto(item, { id: 'user-rj', email: null }, 'RJ')).toBe(true);
  expect(pertenceAoContexto(item, { id: 'user-rj', email: null }, 'OUTRA')).toBe(false);
  expect(pertenceAoContexto(item, { id: 'user-outro', email: null }, 'RJ')).toBe(false);
  expect(pertenceAoContexto(item, { id: 'user-rj', email: null }, null)).toBe(false);
});

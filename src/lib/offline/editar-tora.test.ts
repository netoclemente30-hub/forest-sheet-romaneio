import { expect, it } from "vitest";
import { criarFila, type ItemFila } from "./fila";
import { corrigirToraLocal, toraLocalEditavel } from "./editar-tora";
import { estoqueComFila, torasDeManejo } from "@/lib/tora-origem";
import { projetarDados } from "./projecao";
import type { Tora } from "@/lib/data";

const tora = { empresa_id: "e", plaqueta: 3, arvore: 10, origem: "manejo", volume: 2 } as Tora;
function memoria() {
  const itens = new Map<string, ItemFila>();
  return criarFila({
    all: async () => [...itens.values()],
    put: async (i) => {
      itens.set(i.id, i);
    },
    del: async (id) => {
      itens.delete(id);
    },
  });
}
it("lança tora 3, corrige e reabre a lista offline sem duplicar nem depender do servidor", async () => {
  const f = memoria();
  const inicial = await f.enfileirar({ tipo: "tora_insert", dados: { ...tora } });
  expect(torasDeManejo(estoqueComFila([], await f.listar(), "e"))[0]?.plaqueta).toBe(3);
  expect(await corrigirToraLocal(f, tora, { volume: 4, especie: "Ipê" })).toBe(true);
  const itens = await f.listar();
  expect(itens).toHaveLength(1);
  expect(itens[0]?.id).toBe(inicial.id);
  expect(torasDeManejo(estoqueComFila([], itens, "e"))).toEqual([
    expect.objectContaining({ plaqueta: 3, volume: 4, especie: "Ipê" }),
  ]);
});
it("não reescreve um envio com resposta incerta nem outra empresa", async () => {
  const f = memoria();
  const item = await f.enfileirar({ tipo: "tora_insert", dados: { ...tora } });
  expect(await corrigirToraLocal(f, { ...tora, empresa_id: "outra" }, { volume: 9 })).toBe(false);
  await f.iniciarEnvio(item.id);
  await expect(corrigirToraLocal(f, tora, { volume: 9 })).rejects.toThrow("confirmação");
  expect((await f.listar())[0]?.op).toEqual(item.op);
});
it("somente o autor pode corrigir sua tora local pela permissão de lançamento", () => {
  const item: ItemFila = {
    id: "a",
    criadoEm: 1,
    usuario_id: "u",
    op: { tipo: "tora_insert", dados: { ...tora } },
  };
  expect(toraLocalEditavel(tora, [item], "u")).toBe(true);
  expect(toraLocalEditavel(tora, [item], "outro")).toBe(false);
  expect(toraLocalEditavel(tora, [{ ...item, envio_iniciado: true }], "u")).toBe(false);
});
it("romaneio local abre com suas toras e os detalhes salvos sem alterar a base", async () => {
  const f = memoria();
  await f.enfileirar({ tipo: "tora_insert", dados: { ...tora } });
  await f.enfileirar({
    tipo: "romaneio_salvar",
    empresa_id: "e",
    cab: { placa: "ABC1234", motorista: "João", cpf: "", julieta: "", data: "2026-11-24" },
    plaquetas: [3],
    total_volume: 2,
    qtd_toras: 1,
  });
  const itens = await f.listar();
  const roms = projetarDados<{ id: string }>("romaneios", [], itens, "e");
  expect(roms).toHaveLength(1);
  const toras = estoqueComFila([], itens, "e").filter((t) => t.romaneio_id === roms[0]?.id);
  expect(toras).toHaveLength(1);
  expect(toras[0]?.plaqueta).toBe(3);
});

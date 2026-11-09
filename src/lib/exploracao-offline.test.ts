import { describe, expect, it } from "vitest";
import { criarFila, type FilaStore, type ItemFila, type Op } from "./offline/fila";
import { sincronizar } from "./offline/sync";

function memoria(): FilaStore {
  const itens = new Map<string, ItemFila>();
  return { all: async () => [...itens.values()], put: async (i) => void itens.set(i.id, i), del: async (id) => void itens.delete(id) };
}

const log = { acao: "GPS", detalhe: "teste", user_email: null, lat: -9, lng: -63, criado_em: "2026-11-09T00:00:00Z" };

describe("fila do mapa exploratório", () => {
  it("mantém empresa, AUTEX e identidade dos pontos ao sincronizar", async () => {
    const f = criarFila(memoria());
    const arvore: Op = { tipo: "arvore_gps", id: "arvore-1", empresa_id: "empresa-1", autex: "AUTEX-1", dados: { latitude: -9, longitude: -63, gps_precisao: 8, localizado_em: "2026-11-09T00:00:00Z", abatida_em: "2026-11-09T00:00:00Z" }, log };
    const rastro: Op = { tipo: "rastro_salvar", empresa_id: "empresa-1", autex: "AUTEX-1", pontos: [{ id: "ponto-1", empresa_id: "empresa-1", autex: "AUTEX-1", sessao_id: "percurso-1", lat: -9, lng: -63, precisao: 8, capturado_em: "2026-11-09T00:00:00Z", user_id: "usuario-1" }], log };
    await f.enfileirar(arvore);
    await f.enfileirar(rastro);
    const enviadas: Op[] = [];
    expect(await sincronizar(f, async (op) => { enviadas.push(op); })).toEqual({ enviados: 2, erros: 0 });
    expect(enviadas).toEqual([arvore, rastro]);
    expect(await f.listar()).toEqual([]);
  });
});

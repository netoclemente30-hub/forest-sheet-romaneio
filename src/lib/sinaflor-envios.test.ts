import { beforeEach, describe, expect, it } from "vitest";
import {
  chaveSinaflor, gravarEnvios, idAbatida, idTracada,
  lerEnvios, marcarEnvios, pendentesDeEnvio,
} from "./sinaflor-envios";

beforeEach(() => window.localStorage.clear());

describe("histórico local de lançamentos no SINAFLOR", () => {
  it("separa confirmações por conta, empresa e AUTEX", () => {
    const chaveA = chaveSinaflor("cortador", "emp1", "autex123");
    const chaveB = chaveSinaflor("outro", "emp1", "autex123");
    const chaveC = chaveSinaflor("cortador", "emp2", "autex123");
    const chaveD = chaveSinaflor("cortador", "emp1", "autex999");
    gravarEnvios(chaveA, marcarEnvios(lerEnvios(chaveA), "abatidas", ["7451"]));
    expect(lerEnvios(chaveA).abatidas).toEqual(["7451"]);
    expect(lerEnvios(chaveB).abatidas).toEqual([]);
    expect(lerEnvios(chaveC).abatidas).toEqual([]);
    expect(lerEnvios(chaveD).abatidas).toEqual([]);
  });

  it("omite registros confirmados mesmo em períodos sobrepostos", () => {
    const lista = [{ numero: 7451 }, { numero: 7452 }, { numero: 7451 }];
    const marcados = marcarEnvios({ abatidas: [], tracadas: [] }, "abatidas", ["7451", "7451"]);
    expect(marcados.abatidas).toEqual(["7451"]);
    expect(pendentesDeEnvio(lista, marcados.abatidas, idAbatida)).toEqual([{ numero: 7452 }]);
  });

  it("distingue as secções de uma mesma árvore", () => {
    const registros = [{ arvore: 7758, secao: "A" }, { arvore: 7758, secao: "b" }, { arvore: 7758, secao: "C" }];
    expect(pendentesDeEnvio(registros, ["7758:A", "7758:B"], idTracada)).toEqual([registros[2]]);
  });

  it("recupera armazenamento corrompido sem confundir com confirmação", () => {
    const key = chaveSinaflor("usuario", "empresa", "autex");
    window.localStorage.setItem(key, "arquivo corrompido");
    expect(lerEnvios(key)).toEqual({ abatidas: [], tracadas: [] });
  });
});

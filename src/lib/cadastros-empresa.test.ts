import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), comCache: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));
vi.mock("@/lib/offline/cache", () => ({
  comCache: (nome: string, buscar: () => Promise<unknown>) => mocks.comCache(nome, buscar),
}));

import {
  empresaDaOperacao,
  listarCadastrosRomaneio,
  listarPatiosSerraria,
  somenteDaEmpresa,
} from "./cadastros-empresa";

const rj = "empresa-rj";
const madenorte = "empresa-madenorte";
const dados = {
  motoristas: [
    { empresa_id: rj, nome: "Motorista RJ", cpf: "cpf-rj" },
    { empresa_id: madenorte, nome: "Motorista M", cpf: "cpf-m" },
  ],
  veiculos: [
    { empresa_id: rj, placa: "PLACA-RJ", tipo: "caminhao" },
    { empresa_id: madenorte, placa: "PLACA-M", tipo: "caminhao" },
  ],
  romaneios: [
    { empresa_id: rj, cliente: { nome: "José Clemente", documento: "doc-rj", municipio: "Ariquemes" } },
    { empresa_id: rj, cliente: { nome: "josé clemente", documento: "antigo" } },
    { empresa_id: madenorte, cliente: { nome: "Cliente M", documento: "doc-m" } },
  ],
  patios: [
    { empresa_id: rj, nome: "Pátio RJ" },
    { empresa_id: madenorte, nome: "Pátio M" },
  ],
};

beforeEach(() => {
  mocks.from.mockReset();
  mocks.comCache.mockReset().mockImplementation((_nome, fn) => fn());
  mocks.from.mockImplementation((tabela: keyof typeof dados) => ({
    select: () => ({
      eq: (campo: string, empresa: string) => {
        if (campo !== "empresa_id") throw new Error("Consulta sem filtro por empresa");
        const resultado = { data: dados[tabela].filter((d) => d.empresa_id === empresa), error: null };
        return {
          order: async () => resultado,
          not: () => ({ order: () => ({ limit: async () => resultado }) }),
        };
      },
    }),
  }));
});

describe("isolamento de cadastros RJ e MADENORTE", () => {
  it("superadmin precisa selecionar empresa nas telas operacionais", () => {
    expect(empresaDaOperacao(true, rj, null)).toBeNull();
    expect(empresaDaOperacao(true, rj, madenorte)).toBe(madenorte);
    expect(empresaDaOperacao(false, madenorte, rj)).toBe(madenorte);
  });

  it("sem empresa não consulta cadastros privados nem pátios", async () => {
    expect(await listarCadastrosRomaneio("")).toEqual({ motoristas: [], veiculos: [], clientes: [] });
    expect(await listarPatiosSerraria("")).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("consulta apenas motoristas, CPF e placas da empresa selecionada", async () => {
    expect(await listarCadastrosRomaneio(madenorte)).toEqual({
      motoristas: [dados.motoristas[1]],
      veiculos: [dados.veiculos[1]],
      clientes: [dados.romaneios[2]!.cliente],
    });
    expect(await listarCadastrosRomaneio(rj)).toEqual({
      motoristas: [dados.motoristas[0]],
      veiculos: [dados.veiculos[0]],
      clientes: [dados.romaneios[0]!.cliente,dados.romaneios[1]!.cliente],
    });
    expect(mocks.from).toHaveBeenCalledTimes(6);
  });

  it("o pátio da RJ nunca aparece como sugestão da MADENORTE", async () => {
    expect(await listarPatiosSerraria(madenorte)).toEqual([dados.patios[1]]);
    expect(mocks.comCache).toHaveBeenCalledWith(
      "patios-serraria:empresa-madenorte", expect.any(Function),
    );
  });

  it("rejeita linhas de outra empresa mesmo se resposta vier misturada", () => {
    expect(somenteDaEmpresa(dados.motoristas, madenorte)).toEqual([dados.motoristas[1]]);
    expect(somenteDaEmpresa(dados.patios, rj)).toEqual([dados.patios[0]]);
  });
});

import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  chaveEmpresasMenu,
  ehConsultaDeEmpresas,
  invalidarEmpresas,
  manterNaTrocaDeEmpresa,
} from "@/lib/empresas-consulta";

// Regra: criar ou liberar uma empresa tem que atualizar tanto a tabela da tela
// Usuários quanto o seletor do topo, sem recarregar o app.
describe("lista de empresas: tela Usuários e seletor do topo", () => {
  it("reconhece as duas consultas da lista de empresas", () => {
    expect(ehConsultaDeEmpresas(["empresas"])).toBe(true);
    expect(ehConsultaDeEmpresas(chaveEmpresasMenu("u1"))).toBe(true);
    expect(ehConsultaDeEmpresas(["usuarios"])).toBe(false);
    expect(ehConsultaDeEmpresas(["toras"])).toBe(false);
  });

  it("atualiza as duas listas ao criar ou liberar uma empresa", async () => {
    const qc = new QueryClient();
    qc.setQueryData(["empresas"], [{ id: "e1", nome: "RJ", status: "pendente" }]);
    qc.setQueryData(chaveEmpresasMenu("u1"), [{ id: "e1", nome: "RJ", status: "pendente" }]);
    qc.setQueryData(["toras"], [{ plaqueta: 1 }]);

    await invalidarEmpresas(qc);

    expect(qc.getQueryState(["empresas"])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(chaveEmpresasMenu("u1"))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(["toras"])?.isInvalidated).toBe(false);
  });

  it("mantém as listas de empresas na troca de empresa e descarta o resto", () => {
    expect(manterNaTrocaDeEmpresa(["empresas"])).toBe(true);
    expect(manterNaTrocaDeEmpresa(chaveEmpresasMenu("u1"))).toBe(true);
    expect(manterNaTrocaDeEmpresa(["toras"])).toBe(false);
    expect(manterNaTrocaDeEmpresa(["registros"])).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  FUNCOES, funcaoValida, nomePapel, papelDoUsuario,
  pode, rotaInicial, rotaPermitida, type Papel, type Permissao,
} from "./funcoes";

describe("funções individuais por empresa", () => {
  it("reconhece seis cargos operacionais, sem criar admin por cargo escolhido", () => {
    expect(FUNCOES.map((f) => f.valor)).toEqual([
      "cortador", "tratorista", "romaneador", "motorista",
      "gerente_patio", "gerente_escritorio",
    ]);
    expect(funcaoValida("admin_empresa")).toBe(false);
    expect(funcaoValida("superadmin")).toBe(false);
    expect(funcaoValida("motorista")).toBe(true);
    expect(papelDoUsuario(false, false, "admin_empresa")).toBe("sem_funcao");
    expect(papelDoUsuario(true, false, "cortador")).toBe("superadmin");
    expect(papelDoUsuario(false, true, "cortador")).toBe("admin_empresa");
    expect(nomePapel("gerente_escritorio")).toBe("Gerente de escritório");
  });

  const permissões: [Papel, Permissao[], Permissao[]][] = [
    ["cortador",
      ["mapa_ver","mapa_abater","mapa_rastrear"],
      ["mapa_arrastar","toras_lancar","patios_criar","carga_criar","serraria_operar","registros_ver","registros_reverter","usuarios_gerenciar"]],
    ["tratorista",
      ["mapa_ver","mapa_arrastar","mapa_rastrear"],
      ["mapa_abater","toras_lancar","patios_criar","carga_criar","serraria_operar","usuarios_gerenciar"]],
    ["romaneador",
      ["mapa_ver","toras_lancar","patios_criar"],
      ["mapa_abater","mapa_arrastar","carga_criar","serraria_operar","usuarios_gerenciar"]],
    ["motorista",
      ["carga_criar","nfe_txt","toras_ver"],
      ["mapa_abater","mapa_arrastar","toras_lancar","patios_criar","serraria_operar","registros_reverter"]],
    ["gerente_patio",
      ["serraria_ver","serraria_operar","relatorios"],
      ["mapa_abater","mapa_arrastar","toras_lancar","patios_criar","carga_criar","registros_reverter"]],
    ["gerente_escritorio",
      ["mapa_ver","toras_ver","serraria_ver","relatorios","registros_ver","informacoes_ver"],
      ["mapa_abater","mapa_arrastar","mapa_rastrear","toras_lancar","patios_criar","carga_criar","serraria_operar","registros_reverter","usuarios_gerenciar","base_importar"]],
    ["sem_funcao",[],
      ["mapa_ver","mapa_abater","mapa_arrastar","toras_lancar","patios_criar","carga_criar","serraria_operar","relatorios","registros_ver","usuarios_gerenciar"]],
  ];
  for (const [papel, liberadas, negadas] of permissões) {
    it(papel + ": permite apenas as ações corretas", () => {
      for (const perm of liberadas) expect(pode(papel, perm)).toBe(true);
      for (const perm of negadas) expect(pode(papel, perm)).toBe(false);
    });
  }

  it("administradores têm funções globais, enquanto funcionários não promovem a si mesmos", () => {
    for (const cargo of ["superadmin", "admin_empresa"] as const) {
      expect(pode(cargo, "usuarios_gerenciar")).toBe(true);
      expect(pode(cargo, "registros_reverter")).toBe(true);
      expect(pode(cargo, "mapa_abater")).toBe(true);
      expect(pode(cargo, "mapa_arrastar")).toBe(true);
    }
  });

  it("rotas diretas não pulam o bloqueio pelo cargo", () => {
    expect(rotaPermitida("cortador", "/cortador")).toBe(true);
    expect(rotaPermitida("cortador", "/toras")).toBe(false);
    expect(rotaPermitida("tratorista", "/romaneio")).toBe(false);
    expect(rotaPermitida("tratorista", "/cortador")).toBe(true);
    expect(rotaPermitida("romaneador", "/explanadas")).toBe(true);
    expect(rotaPermitida("romaneador", "/romaneio")).toBe(false);
    expect(rotaPermitida("motorista", "/romaneio")).toBe(true);
    expect(rotaPermitida("motorista", "/historico/abc")).toBe(true);
    expect(rotaPermitida("motorista", "/registros")).toBe(false);
    expect(rotaPermitida("gerente_patio", "/serraria")).toBe(true);
    expect(rotaPermitida("gerente_patio", "/saldo")).toBe(true);
    expect(rotaPermitida("gerente_patio", "/usuarios")).toBe(false);
    expect(rotaPermitida("gerente_escritorio", "/registros")).toBe(true);
    expect(rotaPermitida("gerente_escritorio", "/base")).toBe(true);
    expect(rotaPermitida("gerente_escritorio", "/explanadas")).toBe(true);
    expect(rotaPermitida("gerente_escritorio", "/importar")).toBe(false);
    expect(rotaPermitida("gerente_escritorio", "/fiscal")).toBe(true);
    expect(rotaPermitida("gerente_patio", "/fiscal")).toBe(false);
    expect(rotaPermitida("sem_funcao", "/cortador")).toBe(false);
    expect(rotaPermitida("cortador", "/")).toBe(false);
    expect(rotaPermitida("admin_empresa", "/usuarios")).toBe(true);
    expect(rotaPermitida("superadmin", "/usuarios")).toBe(true);
  });

  it("abre a rota de trabalho de cada cargo ao entrar", () => {
    expect(rotaInicial("cortador")).toBe("/cortador");
    expect(rotaInicial("tratorista")).toBe("/cortador");
    expect(rotaInicial("romaneador")).toBe("/toras");
    expect(rotaInicial("motorista")).toBe("/romaneio");
    expect(rotaInicial("gerente_patio")).toBe("/serraria");
    expect(rotaInicial("gerente_escritorio")).toBe("/");
  });
});

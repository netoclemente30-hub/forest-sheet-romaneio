import { it, expect, vi } from "vitest";
import { importarCarga } from "./fiscal-cargas";
import { detalhesIniciais } from "./fiscal";
const dados = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (nome: string) => dados.from(nome) },
}));
it("importa cliente, endereço e volumes de um romaneio de toras como Entrada", async () => {
  const filtro = vi.fn();
  dados.from.mockImplementation((tabela: string) => {
    const q = {
      select: () => q,
      eq: (campo: string, valor: string) => {
        filtro(campo, valor);
        return q;
      },
      single: () => q,
      throwOnError: async () => ({
        data:
          tabela === "romaneios"
            ? {
                id: "rom",
                placa: "ABC1234",
                data: "2026-11-24",
                qtd_toras: 2,
                motorista: "Condutor",
                cpf: "123",
                julieta: "DEF1234",
                cliente: {
                  nome: "João",
                  documento: "11144477735",
                  logradouro: "Estrada do Manejo",
                  numero: "10",
                  bairro: "Zona Rural",
                  municipio: "Manaus",
                  uf: "AM",
                  cep: "69000000",
                },
              }
            : [
                { especie: "Jatobá", volume: 1.5 },
                { especie: "Jatobá", volume: 2.25 },
              ],
      }),
    };
    return q;
  });
  const carga = await importarCarga("empresa-a", "toras/rom");
  expect(filtro).toHaveBeenCalledWith("empresa_id", "empresa-a");
  expect(carga.itens[0]?.quantidade).toBe(3.75);
  expect(carga.motorista?.nome).toBe("Condutor");
  const detalhes = detalhesIniciais(carga);
  expect(detalhes.nome).toBe("João");
  expect(detalhes.documento).toBe("11144477735");
  expect(detalhes.endereco.logradouro).toBe("Estrada do Manejo");
  expect(detalhes.cabecalho?.tipo).toBe("0");
});

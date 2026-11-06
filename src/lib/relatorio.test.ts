import { describe, expect, it } from "vitest";
import { ordenarToras } from "./relatorio";
import type { Tora } from "./data";
const t = (plaqueta: number, especie: string, volume: number) => ({ plaqueta, especie, volume }) as unknown as Tora;
const lista = [t(5, "Ipê", 1), t(12, "Angelim", 3), t(8, "Cumaru", 2)];
describe("ordenarToras", () => {
  it("ordem numérica decrescente", () => expect(ordenarToras(lista, "plaqueta_desc").map((x) => x.plaqueta)).toEqual([12, 8, 5]));
  it("ordem alfabética", () => expect(ordenarToras(lista, "especie_asc").map((x) => x.especie)).toEqual(["Angelim", "Cumaru", "Ipê"]));
});

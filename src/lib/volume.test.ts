import { describe, it, expect } from "vitest";
import { volumeTora } from "./volume";

describe("volumeTora", () => {
  it("bate com a planilha (plaqueta 1: 73/68, 67/62, 7,6 m)", () => {
    // ((PI*(0.705/2)^2 + PI*(0.645/2)^2)/2)*7.6
    expect(volumeTora({ d_topo1: 73, d_topo2: 68, d_pe1: 67, d_pe2: 62, comprimento: 7.6 })).toBe(2.725);
  });
  it("diâmetro faltando conta como zero naquela ponta", () => {
    expect(volumeTora({ d_topo1: 0, d_topo2: 68, d_pe1: 0, d_pe2: 0, comprimento: 7 })).toBe(0);
  });
});

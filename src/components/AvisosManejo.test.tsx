import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Arvore, Tora } from "@/lib/data";
import { AvisosManejo } from "./AvisosManejo";

vi.mock("@/hooks/useFilaOffline", () => ({ useFilaOffline: () => ({ itens: [] }) }));
vi.mock("@/lib/data", () => ({
  autexQuery: { queryKey: ["autex"], enabled: false, queryFn: async () => [] },
}));

it("mostra 85% e comprimento em tempo real, substitui a tora em edição e isola empresa e AUTEX", () => {
  const qc = new QueryClient();
  qc.setQueryData(["autex"], [{ numero: "A", empresa_id: "E", limites_especies: [{ especie: "Ipê", volume_m3: 20 }] }]);
  const base = { arvore: 1, especie: "IPE", autex: "A", origem: "manejo", empresa_id: "E", comprimento: 7, volume: 6 };
  const toras = [
    { ...base, plaqueta: 1 }, { ...base, plaqueta: 2 }, { ...base, plaqueta: 3 },
    { ...base, plaqueta: 4, empresa_id: "Outra" }, { ...base, plaqueta: 5, autex: "B" },
    { ...base, plaqueta: 6, origem: "serraria" },
  ] as Tora[];
  const props = { toras, arvores: [{ numero: 1, empresa_id: "E", autex: "A", altura: 18 }] as Arvore[],
    empresa: "E", autex: "A", arvore: 1, especie: "Ipê", plaquetaAnterior: 3, comprimento: 7 };
  const renderizar = (volume: number) => <QueryClientProvider client={qc}><AvisosManejo {...props} volume={volume} /></QueryClientProvider>;
  const tela = render(renderizar(4.99));
  expect(screen.queryByText("Volume próximo do limite autorizado")).toBeNull();
  expect(screen.getByText(/soma das secções \(21,0 m\).*18,0 m.*3,0 m/)).toBeTruthy();
  tela.rerender(renderizar(5));
  expect(screen.getByText("Volume próximo do limite autorizado")).toBeTruthy();
  tela.rerender(renderizar(8));
  expect(screen.queryByText("Volume autorizado ultrapassado")).toBeNull();
  tela.rerender(renderizar(9));
  expect(screen.getByText("Volume autorizado ultrapassado")).toBeTruthy();
  expect(screen.getByText(/Excedente: 1,0000 m³/)).toBeTruthy();
});

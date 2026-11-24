import { afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { EventosNfe } from "@/components/EventosNfe";
const mocks = vi.hoisted(() => ({ consultar: vi.fn(), enviar: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@/lib/spedy.functions", () => ({
  consultarEventosNfe: (...a: unknown[]) => mocks.consultar(...a),
  enviarEventoNfe: (...a: unknown[]) => mocks.enviar(...a),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("confere autorização, exige texto e confirmação e consulta o protocolo após envio", async () => {
  mocks.consultar.mockResolvedValue({
    ok: true,
    situacao: "authorized",
    eventos: [],
    historico: [],
  });
  mocks.enviar.mockResolvedValue({
    ok: true,
    situacao: "evento_pendente",
    mensagem: "Solicitação recebida.",
  });
  render(<EventosNfe empresa="empresa" rascunhoId="rascunho" />);
  expect(screen.getByText("Cancelar NF-e")).toBeDisabled();
  fireEvent.click(screen.getByText("Consultar eventos fiscais"));
  await waitFor(() => expect(screen.getByText("Carta de correção")).toBeEnabled());
  fireEvent.click(screen.getByText("Carta de correção"));
  expect(screen.getByText("Confirmar envio em homologação")).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Texto da carta de correção"), {
    target: { value: "Corrigir a descrição do transporte de madeira." },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  mocks.consultar.mockResolvedValue({
    ok: true,
    situacao: "authorized",
    eventos: [
      {
        id: "ev",
        tipo: "correctionLetter",
        data: "2026-11-23",
        protocolo: "P123",
        codigo: "135",
        mensagem: "Registrado",
      },
    ],
    historico: [],
  });
  fireEvent.click(screen.getByText("Confirmar envio em homologação"));
  await screen.findByText(/Protocolo P123/);
  expect(mocks.enviar).toHaveBeenCalledWith({
    data: expect.objectContaining({
      empresa: "empresa",
      rascunhoId: "rascunho",
      tipo: "correcao",
      confirmacao: "HOMOLOGACAO",
    }),
  });
});
it("mantém ações bloqueadas quando a nota foi cancelada", async () => {
  mocks.consultar.mockResolvedValue({ ok: true, situacao: "canceled", eventos: [], historico: [] });
  render(<EventosNfe empresa="empresa" rascunhoId="r" />);
  fireEvent.click(screen.getByText("Consultar eventos fiscais"));
  await screen.findByText(/Situação na Spedy · Cancelada/);
  expect(screen.getByText("Carta de correção")).toBeDisabled();
  expect(screen.getByText("Cancelar NF-e")).toBeDisabled();
});

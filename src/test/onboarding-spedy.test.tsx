import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const enviar = vi.fn();
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f, createServerFn: vi.fn() }));
vi.mock("@/lib/spedy.functions", () => ({ verificarCadastroSpedy: vi.fn(), cadastrarEmpresaSpedy: vi.fn(), enviarCertificadoSpedy: (...a: unknown[]) => enviar(...a) }));
import { OnboardingSpedy } from "@/components/OnboardingSpedy";

const EMP = "6d4582f7-b121-4d90-9708-e8c544591397";
function preparar() {
  render(<OnboardingSpedy empresa={EMP} cadastro={{ nome: "M", cnpj: "11222333000181", ie: "" }} />);
  fireEvent.change(screen.getByLabelText("Arquivo do certificado A1 (.pfx)"), { target: { files: [new File([new Uint8Array([0x30])], "a.pfx")] } });
  fireEvent.change(screen.getByLabelText("Senha do certificado"), { target: { value: "segredo" } });
  fireEvent.click(screen.getByLabelText(/Confirmo o envio deste certificado/));
}
describe("OnboardingSpedy · certificado", () => {
  it("limpa arquivo e senha quando a rede rejeita", async () => {
    enviar.mockRejectedValueOnce(new Error("rede"));
    preparar();
    fireEvent.click(screen.getByRole("button", { name: "Enviar certificado" }));
    await waitFor(() => expect((screen.getByLabelText("Senha do certificado") as HTMLInputElement).value).toBe(""));
    expect((screen.getByLabelText(/Confirmo o envio deste certificado/) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole("button", { name: "Enviar certificado" })).toBeDisabled();
    expect(enviar).toHaveBeenCalledTimes(1);
  });
  it("mantém só durante a confirmação de substituição e limpa ao cancelar", async () => {
    enviar.mockResolvedValueOnce({ ok: true, situacao: "confirmar_substituicao", mensagem: "Confirme", atual: { subject: "ANTIGO", expirationAt: null } });
    preparar();
    fireEvent.click(screen.getByRole("button", { name: "Enviar certificado" }));
    await screen.findByLabelText(/Substituir o certificado ativo/);
    expect((screen.getByLabelText("Senha do certificado") as HTMLInputElement).value).toBe("segredo");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect((screen.getByLabelText("Senha do certificado") as HTMLInputElement).value).toBe("");
    expect(screen.queryByLabelText(/Substituir o certificado ativo/)).toBeNull();
  });
});

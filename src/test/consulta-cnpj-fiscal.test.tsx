import { it, expect, vi, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { ConsultaCnpjFiscal } from "@/components/ConsultaCnpjFiscal";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("descarta consulta atrasada após trocar o documento", async () => {
  vi.useFakeTimers();
  let resolver!: (r: unknown) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((r) => {
          resolver = r;
        }),
    ),
  );
  const aplicar = vi.fn();
  const view = render(<ConsultaCnpjFiscal documento="11222333000181" aplicar={aplicar} />);
  await act(async () => {
    vi.advanceTimersByTime(501);
  });
  view.rerender(<ConsultaCnpjFiscal documento="" aplicar={aplicar} />);
  await act(async () => {
    resolver({ ok: true, json: async () => ({ cnpj: "11222333000181", razao_social: "Antiga" }) });
  });
  expect(aplicar).not.toHaveBeenCalled();
});

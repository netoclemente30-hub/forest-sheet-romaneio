import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInstallApp } from "./useInstallApp";

afterEach(() => vi.restoreAllMocks());

function setup(standalone = false) {
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: standalone, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
  return renderHook(useInstallApp);
}

describe("instalação do app", () => {
  it("aciona o pedido de instalação apenas ao clicar, sem repetir um pedido consumido", async () => {
    const { result } = setup();
    const event = new Event("beforeinstallprompt", { cancelable: true });
    const prompt = vi.fn().mockResolvedValue(undefined);
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: "dismissed" }) });
    act(() => window.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    await act(() => result.current.install());
    expect(prompt).toHaveBeenCalledTimes(1);
    await act(() => result.current.install());
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(result.current.helpOpen).toBe(true);
  });

  it("oferece alternativa se o navegador não disponibiliza o pedido", async () => {
    const { result } = setup();
    await act(() => result.current.install());
    expect(result.current.helpOpen).toBe(true);
  });

  it("não solicita instalação quando já aberto como app", async () => {
    const { result } = setup(true);
    await act(() => result.current.install());
    expect(result.current.installed).toBe(true);
    expect(result.current.helpOpen).toBe(false);
  });

  it("atualiza o estado após o navegador confirmar a instalação", async () => {
    const { result } = setup();
    act(() => window.dispatchEvent(new Event("appinstalled")));
    await waitFor(() => expect(result.current.installed).toBe(true));
  });
});
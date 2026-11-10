import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { modeloDoUserAgent } from "./aparelho";

describe("modeloDoUserAgent", () => {
  it("detecta modelo Android", () => {
    expect(modeloDoUserAgent("Mozilla/5.0 (Linux; Android 13; 23043RP34G Build/TKQ1) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36")).toBe("Android 13 · 23043RP34G · Chrome");
  });
  it("ignora modelo reduzido K", () => {
    expect(modeloDoUserAgent("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/120 Safari/537.36")).toBe("Android 10 · Chrome");
  });
  it("detecta iPhone", () => {
    expect(modeloDoUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17 Mobile Safari/604.1")).toBe("iPhone · Safari");
  });
});

import { describe, expect, it } from "vitest";
import { hostnameBloqueado } from "./pwa-register";

describe("segurança dos contextos offline", () => {
  it("recusa previews, inclusive drafts e previews live", () => {
    for (const host of [
      "id-preview--5705700e-da9f-4996-a3d9-61406b8a4191.lovable.app",
      "id-preview-6--5705700e-da9f-4996-a3d9-61406b8a4191.lovable.app",
      "preview-abc--manejo.workspace.lovable.app",
      "live--5705700e-da9f-4996-a3d9-61406b8a4191.workspace.lovable.app",
      "project--5705700e-da9f-4996-a3d9-61406b8a4191-dev.lovable.app",
    ]) expect(hostnameBloqueado(host)).toBe(true);
  });
  it("permite o app publicado e não bloqueia domínios por prefixo somente", () => {
    expect(hostnameBloqueado("forest-sheet-romaneio.lovable.app")).toBe(false);
    expect(hostnameBloqueado("preview--manejo.example.com")).toBe(false);
  });
});
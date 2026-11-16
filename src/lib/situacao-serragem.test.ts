import { describe, expect, it } from "vitest";
import type { Tora } from "./data";
import { dataHoraSerragem, situacaoSerragem } from "./situacao-serragem";
import { qrTora } from "./tora-qr";
import { resolverQrSerragem } from "./qr-serragem";

const dataSerragem = "2026-11-16T01:39:00Z";
const tora = {
  empresa_id: "madenorte", plaqueta: 1, arvore: 394,
  autex: "autex geraldo", secao: "A", especie: "Abiurana",
  publico_id: "a5ef9bc0-9739-4d88-81fc-1ff25cf7df6a",
  serrada_em: null,
} as Tora;

describe("QR no pátio da serraria e consulta de serragem", () => {
  it("mostra a data e hora do corte no fuso fixo de Rondônia", () => {
    const data = dataHoraSerragem(dataSerragem);
    expect(data).toContain("15/11/2026");
    expect(data).toContain("21:39");
    expect(situacaoSerragem(dataSerragem)).toEqual({
      status: "Serrada",
      detalhe: "Serrada em " + data,
      serrada: true,
    });
  });

  it("não inventa data de serragem antes da baixa", () => {
    expect(situacaoSerragem(null)).toEqual({
      status: "Ainda não serrada",
      detalhe: "Sem data de serragem registrada",
      serrada: false,
    });
    expect(dataHoraSerragem("inválido")).toBeNull();
  });

  it("mantém o MESMO QR após serrar; a ficha consulta a data atual", () => {
    const serrada = { ...tora, serrada_em: dataSerragem };
    const codigo = qrTora(tora);
    expect(codigo).toContain("/t/a5ef9bc0-9739-4d88-81fc-1ff25cf7df6a");
    expect(qrTora(serrada)).toBe(codigo);
    const atual = resolverQrSerragem(codigo, [serrada], "madenorte");
    expect(situacaoSerragem(atual.serrada_em).status).toBe("Serrada");
    expect(situacaoSerragem(atual.serrada_em).detalhe).toContain("15/11/2026");
  });

  it("não acessa tora da RJ com QR da MADENORTE e não cruza plaquetas", () => {
    const codigo = qrTora(tora);
    expect(() => resolverQrSerragem(codigo, [tora], "rj-madeiras")).toThrow("não encontrada");
  });
});

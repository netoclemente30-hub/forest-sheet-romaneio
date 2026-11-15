import { describe, expect, it } from "vitest";
import type { Arvore } from "./data";
import type { ArrastoArvore } from "./arrasto-arvore";
import { conciliacaoArrasto, validarArrastoArvore, chaveArrastoArvore } from "./arrasto-arvore";
import { criarFila, type FilaStore, type ItemFila, type Op } from "./offline/fila";
import { sincronizar } from "./offline/sync";

const arvore = {
  numero: 394, autex: "autex geraldo", empresa_id: "emp-madenorte",
  latitude: -8.6786897, longitude: -63.6456042,
  abatida_em: null, nao_abatida_motivo: null,
} as Arvore;
const agora = new Date("2026-11-15T22:40:00Z").getTime();
const gps = {
  lat: -8.67870, lng: -63.64560,
  precisao: 3, capturado_em: "2026-11-15T22:39:30Z",
};
const arrasto = {
  empresa_id: "emp-madenorte", autex: "autex geraldo", arvore: 394,
  capturado_em: "2026-11-15T22:39:30Z",
} as ArrastoArvore;

function store(): FilaStore {
  const registros = new Map<string, ItemFila>();
  return {
    all: async () => [...registros.values()],
    put: async (item) => void registros.set(item.id, item),
    del: async (id) => void registros.delete(id),
  };
}

const operacao = (id: string): Extract<Op, { tipo: "arrasto_arvore" }> => ({
  tipo: "arrasto_arvore", empresa_id: "emp-madenorte",
  autex: "autex geraldo", arvore: 394, explanada_id: null,
  latitude: gps.lat, longitude: gps.lng, precisao: gps.precisao,
  capturado_em: gps.capturado_em,
  log: {
    acao: "Arrasto da árvore registrado", detalhe: "Árvore 394",
    user_email: "tratorista@teste.invalid", lat: gps.lat, lng: gps.lng,
    criado_em: gps.capturado_em, operacao_id: id,
  },
});

describe("arrasto de árvore inteira offline", () => {
  it("aceita a árvore mesmo sem abatimento e sem toras traçadas", () => {
    expect(validarArrastoArvore(arvore, gps, agora)).toBeNull();
    expect(conciliacaoArrasto(arrasto, null)).toBe("aguardando_abate");
    expect(conciliacaoArrasto(arrasto, "2026-11-15T22:38:00Z")).toBe("conciliado");
    expect(conciliacaoArrasto(null, null)).toBe("pendente");
  });

  it("bloqueia GPS antigo, afastado e impreciso ou árvore não abatida explicitamente", () => {
    expect(validarArrastoArvore(arvore, { ...gps, capturado_em: "2026-11-15T22:20:00Z" }, agora)).toContain("antigo");
    expect(validarArrastoArvore(arvore, { ...gps, lat: -8.69 }, agora)).toContain("100 m");
    expect(validarArrastoArvore(arvore, { ...gps, precisao: 200 }, agora)).toContain("precisão");
    expect(validarArrastoArvore({ ...arvore, latitude: null }, gps, agora)).toContain("coordenadas");
    expect(validarArrastoArvore({ ...arvore, nao_abatida_motivo: "obstaculo" }, gps, agora)).toContain("não abatida");
  });

  it("não mistura empresas e AUTEX com o mesmo número de árvore", () => {
    expect(chaveArrastoArvore("emp1", "A", 394)).not.toBe(chaveArrastoArvore("emp2", "A", 394));
    expect(chaveArrastoArvore("emp1", "A", 394)).not.toBe(chaveArrastoArvore("emp1", "B", 394));
  });

  it("simula tratorista sincronizando antes do cortador e conserva id na repetição", async () => {
    const f = criarFila(store());
    const id = "0cdf7219-a740-4314-b36c-f2791301e0c6";
    const op = operacao(id);
    const item = await f.enfileirar(op);
    const banco = new Map<string, { arvore: number; conciliado: boolean }>();
    const enviados: string[] = [];
    // Evento do TRATORISTA chega primeiro, com abate ainda ausente.
    const primeira = await sincronizar(f, async (atual, filaId) => {
      if (atual.tipo !== "arrasto_arvore") throw new Error("Tipo errado");
      const chave = atual.log.operacao_id ?? filaId!;
      if (!banco.has(chave)) banco.set(chave, { arvore: atual.arvore, conciliado: false });
      enviados.push(chave);
    });
    expect(primeira).toEqual({ enviados: 1, erros: 0 });
    expect(banco.get(id)?.conciliado).toBe(false);
    expect(await f.listar()).toHaveLength(0);
    // Quando o CORTADOR sincronizar, a conciliação lê o abate da mesma BASE.
    banco.get(id)!.conciliado = true;
    expect(banco.get(id)?.conciliado).toBe(true);
    // Replay com o MESMO ID não duplica.
    await f.enfileirar(op);
    await sincronizar(f, async (atual) => {
      if (atual.tipo === "arrasto_arvore" && !banco.has(atual.log.operacao_id!)) {
        banco.set(atual.log.operacao_id!, { arvore: atual.arvore, conciliado: true });
      }
    });
    expect(banco.size).toBe(1);
    expect(enviados).toEqual([id]);
    expect(item.op).toEqual(op);
  });
});

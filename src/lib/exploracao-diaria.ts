import type { Arvore, Romaneio, Tora } from "./data";
import type { ArrastoArvore } from "./arrasto-arvore";

const FUSO = "America/Porto_Velho";

/** Dia civil da exploração no fuso de Rondônia, sem deslocar as datas do tipo DATE. */
export function dataExploracao(iso: string | null | undefined): string | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(data);
  const campo = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return [campo("year"), campo("month"), campo("day")].join("-");
}

export function hojeExploracao(agora = new Date()): string {
  return dataExploracao(agora.toISOString()) ?? "";
}

export type ResumoExploracao = {
  abatidas: number;
  tracadas: number;
  arvoresTracadas: number;
  arvoresArrastadas: number;
  arrastosAguardandoAbate: number;
  arrastadas: number;
  volumeArrastado: number;
  carregadas: number;
  cargas: number;
};

/**
 * Apenas manejo: não mistura peças/toras da serraria com o corte na floresta.
 * A data de carga é a data do romaneio; carregada é o status atual.
 * Operações offline ainda não sincronizadas não entram no relatório oficial.
 */
export function resumoExploracaoDiaria(
  dia: string,
  arvores: Arvore[],
  toras: Tora[],
  romaneios: Romaneio[],
  empresa?: string | null,
  arrastosArvores: ArrastoArvore[] = [],
): ResumoExploracao {
  const daEmpresa = (id: string | null | undefined) => !empresa || id === empresa;

  // Árvore identificada por empresa + AUTEX + número, não apenas por número.
  const abatidas = new Set(
    arvores.filter((a) => daEmpresa(a.empresa_id) && dataExploracao(a.abatida_em) === dia)
      .map((a) => [a.empresa_id ?? "", a.autex, a.numero].join(":")),
  );

  // Uma secção traçada corresponde a uma tora lançada de origem manejo.
  // Em caso de projeções repetidas na memória, a plaqueta só conta uma vez.
  const lancadas = toras.filter((t) =>
    daEmpresa(t.empresa_id) && t.origem === "manejo" && dataExploracao(t.created_at) === dia,
  );
  const torasTracadas = new Map(lancadas.map((t) => [t.empresa_id + ":" + t.plaqueta, t]));
  const arvoresTracadas = new Set(lancadas.map((t) => [t.empresa_id, t.autex ?? "", t.arvore].join(":")));

  const arvoresPorChave = new Map(arvores.map((a) =>
    [[a.empresa_id ?? "", a.autex, a.numero].join(":"), a]));
  const arrastosDoDia = new Map(arrastosArvores.filter((a) =>
    daEmpresa(a.empresa_id) && dataExploracao(a.capturado_em) === dia,
  ).map((a) => [[a.empresa_id, a.autex, a.arvore].join(":"), a]));
  const aguardandoAbate = [...arrastosDoDia.keys()].filter((k) =>
    !arvoresPorChave.get(k)?.abatida_em).length;

  // Cada plaqueta arrastada conta uma vez no dia do trabalho do tratorista,
  // mesmo quando a mesma árvore possui várias secções.
  const torasArrastadas = new Map(toras.filter((t) =>
    daEmpresa(t.empresa_id) &&
    t.origem === "manejo" &&
    dataExploracao(t.arrastada_em) === dia,
  ).map((t) => [t.empresa_id + ":" + t.plaqueta, t]));
  const volumeArrastado = [...torasArrastadas.values()].reduce((soma, t) =>
    soma + (Number.isFinite(Number(t.volume)) ? Number(t.volume) : 0), 0);

  const romaneiosDoDia = romaneios.filter((r) =>
    daEmpresa(r.empresa_id) && r.data === dia,
  );
  const cargas = new Map(romaneiosDoDia.map((r) => [r.id, r.empresa_id]));
  const carregadas = new Set(
    toras.filter((t) =>
      t.origem === "manejo" &&
      t.carregada &&
      daEmpresa(t.empresa_id) &&
      !!t.romaneio_id &&
      cargas.has(t.romaneio_id) &&
      cargas.get(t.romaneio_id) === t.empresa_id,
    ).map((t) => t.empresa_id + ":" + t.plaqueta),
  );

  return {
    abatidas: abatidas.size,
    tracadas: torasTracadas.size,
    arvoresTracadas: arvoresTracadas.size,
    arvoresArrastadas: arrastosDoDia.size,
    arrastosAguardandoAbate: aguardandoAbate,
    arrastadas: torasArrastadas.size,
    volumeArrastado,
    carregadas: carregadas.size,
    cargas: romaneiosDoDia.length,
  };
}

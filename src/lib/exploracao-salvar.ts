import { toast } from "sonner";
import type { Arvore, RastroGPS } from "@/lib/data";
import { capturarLog } from "@/lib/registro";
import { fila, type Op } from "@/lib/offline/fila";
import { estaOnline, executarOp } from "@/lib/offline/sync";
import { idb } from "@/lib/offline/db";
import { lerCache, salvarCache } from "@/lib/offline/cache";
import { atualizarDataAbatimento, comprimentoRastro, mesclarRastros, type Coordenada, type PontoRastro } from "@/lib/exploracao";

export type DadosArvoreGPS = {
  latitude: number;
  longitude: number;
  gps_precisao: number | null;
  localizado_em: string;
  abatida_em: string | null;
  nao_abatida_motivo?: string | null;
  nao_abatida_em?: string | null;
};

export const MOTIVOS_NAO_ABATIDA = [
  { valor: "seca", label: "Árvore seca" },
  { valor: "oca", label: "Árvore oca" },
  { valor: "essencia_errada", label: "Essência errada" },
] as const;
export const textoMotivo = (v: string | null | undefined) => MOTIVOS_NAO_ABATIDA.find((m) => m.valor === v)?.label ?? v ?? "";

function erroDeRede(error: unknown): boolean {
  return !estaOnline() || /fetch|network|failed to fetch/i.test(error instanceof Error ? error.message : String(error));
}

async function executarOuEnfileirar(op: Op): Promise<boolean> {
  await fila().enfileirar(op);
  return true;
}

export async function salvarArvoreGPS({ arvore, empresa, posicao, abatida, motivoNaoAbatida }: {
  arvore: Arvore;
  empresa: string;
  posicao: Coordenada;
  abatida: boolean | null;
  motivoNaoAbatida?: string | null;
}): Promise<{ op: Extract<Op, { tipo: "arvore_gps" }>; offline: boolean }> {
  const agora = new Date().toISOString();
  const dados: DadosArvoreGPS = {
    latitude: posicao.lat,
    longitude: posicao.lng,
    gps_precisao: posicao.precisao ?? null,
    localizado_em: posicao.capturado_em ?? agora,
    abatida_em: motivoNaoAbatida ? null : atualizarDataAbatimento(arvore.abatida_em, abatida, agora),
  };
  if (motivoNaoAbatida !== undefined) {
    dados.nao_abatida_motivo = motivoNaoAbatida;
    dados.nao_abatida_em = motivoNaoAbatida ? agora : null;
  } else if (abatida === true) {
    dados.nao_abatida_motivo = null;
    dados.nao_abatida_em = null;
  }
  const acao = motivoNaoAbatida ? `Árvore não abatida: ${textoMotivo(motivoNaoAbatida)}` : abatida === true ? "Árvore abatida registrada" : abatida === false ? "Abatimento desfeito" : "Localização de árvore registrada";
  const log = await capturarLog(acao, `Árvore ${arvore.numero} · ${arvore.nome_vulgar} · AUTEX ${arvore.autex} · ${posicao.lat.toFixed(6)}, ${posicao.lng.toFixed(6)}`);
  const op = { tipo: "arvore_gps" as const, id: arvore.id, empresa_id: empresa, autex: arvore.autex, dados, log };
  const offline = await executarOuEnfileirar(op);
  return { op, offline };
}

export async function salvarRastro({ empresa, autex, pontos }: {
  empresa: string;
  autex: string;
  pontos: PontoRastro[];
}): Promise<{ op: Extract<Op, { tipo: "rastro_salvar" }>; offline: boolean }> {
  if (!pontos.length) throw new Error("Nenhum ponto do rastro foi capturado");
  const distancia = comprimentoRastro(pontos);
  const log = await capturarLog("Rastreio GPS encerrado", `AUTEX ${autex} · ${pontos.length} pontos · ${Math.round(distancia)} m percorridos`);
  const op = { tipo: "rastro_salvar" as const, empresa_id: empresa, autex, pontos, log };
  const offline = await executarOuEnfileirar(op);
  return { op, offline };
}

export async function persistirArvoreLocal(atual: Arvore[], id: string, dados: DadosArvoreGPS): Promise<Arvore[]> {
  const cache = await lerCache<Arvore>("arvores");
  const base = cache?.length ? cache : atual;
  const atualizada = base.map((a) => a.id === id ? { ...a, ...dados } : a);
  // Local intent lives in the queue, not in the confirmed base.
  return atualizada;
}

export async function persistirRastroLocal(atual: RastroGPS[], autex: string, pontos: PontoRastro[]): Promise<RastroGPS[]> {
  const cache = await lerCache<RastroGPS>(`rastros:${autex}`);
  const agora = new Date().toISOString();
  const novos: RastroGPS[] = pontos.map((p) => ({ ...p, created_at: agora }));
  const atualizado = mesclarRastros(cache ?? [], atual, novos);
  // Pending points are projected from the queue, preserving the confirmed base.
  return atualizado;
}

type RastroAtivo = { empresa: string; autex: string; pontos: PontoRastro[] };

export async function carregarRastroAtivo(empresa: string, autex: string): Promise<PontoRastro[]> {
  try {
    return (await lerCache<RastroAtivo>(`rastro-ativo:${autex}`, empresa))?.[0]?.pontos ?? [];
  } catch {
    return [];
  }
}

export async function guardarRastroAtivo(empresa: string, autex: string, pontos: PontoRastro[]): Promise<void> {
  try {
    await salvarCache(`rastro-ativo:${autex}`, pontos.length ? [{ empresa, autex, pontos } satisfies RastroAtivo] : [], empresa);
  } catch {
    toast.warning("Não foi possível guardar o rastro neste aparelho");
  }
}

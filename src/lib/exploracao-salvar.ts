import { toast } from "sonner";
import type { Arvore, RastroGPS } from "@/lib/data";
import { capturarLog } from "@/lib/registro";
import { fila, type Op } from "@/lib/offline/fila";
import { estaOnline, executarOp } from "@/lib/offline/sync";
import { idb } from "@/lib/offline/db";
import { lerCache, salvarCache } from "@/lib/offline/cache";
import { atualizarDataAbatimento, mesclarRastros, type Coordenada, type PontoRastro } from "@/lib/exploracao";

export type DadosArvoreGPS = {
  latitude: number;
  longitude: number;
  gps_precisao: number | null;
  localizado_em: string;
  abatida_em: string | null;
};

function erroDeRede(error: unknown): boolean {
  return !estaOnline() || /fetch|network|failed to fetch/i.test(error instanceof Error ? error.message : String(error));
}

async function executarOuEnfileirar(op: Op): Promise<boolean> {
  if (estaOnline()) {
    try {
      await executarOp(op);
      return false;
    } catch (error) {
      if (!erroDeRede(error)) throw error;
    }
  }
  await fila().enfileirar(op);
  return true;
}

export async function salvarArvoreGPS({ arvore, empresa, posicao, abatida }: {
  arvore: Arvore;
  empresa: string;
  posicao: Coordenada;
  abatida: boolean | null;
}): Promise<{ op: Extract<Op, { tipo: "arvore_gps" }>; offline: boolean }> {
  const agora = new Date().toISOString();
  const dados: DadosArvoreGPS = {
    latitude: posicao.lat,
    longitude: posicao.lng,
    gps_precisao: posicao.precisao ?? null,
    localizado_em: posicao.capturado_em ?? agora,
    abatida_em: atualizarDataAbatimento(arvore.abatida_em, abatida, agora),
  };
  const acao = abatida === true ? "Árvore abatida registrada" : abatida === false ? "Abatimento desfeito" : "Localização de árvore registrada";
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
  const distancia = pontos.slice(1).reduce((n, p, i) => {
    const a = pontos[i]!;
    const rad = Math.PI / 180;
    const dLat = (p.lat - a.lat) * rad;
    const dLng = (p.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(p.lat * rad) * Math.sin(dLng / 2) ** 2;
    return n + 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }, 0);
  const log = await capturarLog("Rastreio GPS encerrado", `AUTEX ${autex} · ${pontos.length} pontos · ${Math.round(distancia)} m percorridos`);
  const op = { tipo: "rastro_salvar" as const, empresa_id: empresa, autex, pontos, log };
  const offline = await executarOuEnfileirar(op);
  return { op, offline };
}

export async function persistirArvoreLocal(atual: Arvore[], id: string, dados: DadosArvoreGPS): Promise<Arvore[]> {
  const cache = await lerCache<Arvore>("arvores");
  const base = cache?.length ? cache : atual;
  const atualizada = base.map((a) => a.id === id ? { ...a, ...dados } : a);
  await salvarCache("arvores", atualizada);
  return atualizada;
}

export async function persistirRastroLocal(atual: RastroGPS[], autex: string, pontos: PontoRastro[]): Promise<RastroGPS[]> {
  const cache = await lerCache<RastroGPS>(`rastros:${autex}`);
  const agora = new Date().toISOString();
  const novos: RastroGPS[] = pontos.map((p) => ({ ...p, created_at: agora }));
  const atualizado = mesclarRastros(cache ?? [], atual, novos);
  await salvarCache(`rastros:${autex}`, atualizado);
  return atualizado;
}

type RastroAtivo = { empresa: string; autex: string; pontos: PontoRastro[] };
const chaveAtivo = (empresa: string, autex: string) => `rastro-ativo:${empresa}:${autex}`;

export async function carregarRastroAtivo(empresa: string, autex: string): Promise<PontoRastro[]> {
  try {
    return (await idb.get<RastroAtivo>("cache", chaveAtivo(empresa, autex)))?.pontos ?? [];
  } catch {
    return [];
  }
}

export async function guardarRastroAtivo(empresa: string, autex: string, pontos: PontoRastro[]): Promise<void> {
  try {
    if (pontos.length) await idb.put("cache", { empresa, autex, pontos } satisfies RastroAtivo, chaveAtivo(empresa, autex));
    else await idb.del("cache", chaveAtivo(empresa, autex));
  } catch {
    toast.warning("Não foi possível guardar o rastro neste aparelho");
  }
}

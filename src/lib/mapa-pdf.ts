import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { ArquivoGerado } from "@/lib/arquivo";
import { getEmpresaAtiva } from "@/lib/empresa";
import { comCache } from "@/lib/offline/cache";
import { capturarLog, gravarRegistro } from "@/lib/registro";
import { idb } from "@/lib/offline/db";
import { guardarRascunho, contextoLocal } from './offline/rascunho';

export const MAPA_PDF_BUCKET = "mapas-exploracao";
export const MAPA_PDF_MAX_BYTES = 100 * 1024 * 1024;

export type MapaPdf = Database["public"]["Tables"]["mapas_exploracao"]["Row"];
export type ArquivoPdfParaValidar = Pick<File, "name" | "size" | "type" | "slice">;

export function mapaPdfQuery(autex: string) {
  return {
    networkMode: "always" as const,
    queryKey: ["mapa-pdf", autex],
    queryFn: () => comCache<MapaPdf>(`mapa-pdf:${autex}`, async () => {
      let query = supabase.from("mapas_exploracao").select("*").eq("autex", autex).limit(1);
      const empresa = getEmpresaAtiva();
      if (empresa) query = query.eq("empresa_id", empresa);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    }),
  };
}

export async function validarMapaPdf(file: ArquivoPdfParaValidar): Promise<void> {
  if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
    throw new Error("Selecione um arquivo no formato PDF");
  }
  if (file.size <= 0) throw new Error("O PDF está vazio");
  if (file.size > MAPA_PDF_MAX_BYTES) throw new Error("O PDF deve ter no máximo 100 MB");
  const assinatura = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new TextDecoder().decode(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new Error("Não foi possível ler o PDF selecionado"));
    reader.readAsArrayBuffer(file.slice(0, 5));
  });
  if (assinatura !== "%PDF-") throw new Error("O arquivo não contém um PDF válido");
}

export function caminhoMapaPdf(empresa: string, id: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(empresa) || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Identificação inválida para salvar o mapa");
  return `${empresa}/${id}.pdf`;
}

export async function enviarMapaPdf({ file, autex, empresa, atual, userId }: {
  file: File;
  autex: string;
  empresa: string;
  atual: MapaPdf | null;
  userId: string | null;
}): Promise<MapaPdf> {
  await validarMapaPdf(file);
  await guardarRascunho(`mapa-pdf:${autex}`, { file, autex, empresa, atual, confirmado: false }, empresa);
  if (!navigator.onLine) throw new Error("PDF guardado como rascunho neste aparelho. Conecte-se à internet para enviá-lo.");
  const log = await capturarLog(atual ? "PDF do mapa substituído" : "PDF do mapa enviado", `AUTEX ${autex} · ${file.name}`);
  const id = atual?.id ?? crypto.randomUUID();
  const path = atual?.arquivo_path ?? caminhoMapaPdf(empresa, id);
  const { error: erroUpload } = await supabase.storage.from(MAPA_PDF_BUCKET).upload(path, file, {
    contentType: "application/pdf",
    upsert: !!atual,
  });
  if (erroUpload) throw new Error(`Não foi possível enviar o PDF: ${erroUpload.message}`);

  const { data, error } = await supabase.from("mapas_exploracao").upsert({
    id,
    empresa_id: empresa,
    autex,
    arquivo_path: path,
    nome_arquivo: file.name,
    tamanho_bytes: file.size,
    enviado_por: userId,
    atualizado_em: new Date().toISOString(),
  }, { onConflict: "empresa_id,autex" }).select("*").single();
  if (error || !data) {
    if (!atual) await supabase.storage.from(MAPA_PDF_BUCKET).remove([path]);
    throw new Error(`O arquivo foi enviado, mas não foi possível vinculá-lo à AUTEX: ${error?.message ?? "resposta vazia"}`);
  }
  await gravarRegistro(log);
  await guardarPdfLocal(data, file);
  return data;
}

const chavePdf = async (mapa: MapaPdf) => {
  const c = await contextoLocal(mapa.empresa_id);
  return `geopdf:${c.usuario}:${c.empresa}:${mapa.autex}`;
};
async function guardarPdfLocal(mapa: MapaPdf, blob: Blob) {
  try { await idb.put("cache", { versao: mapa.atualizado_em, path: mapa.arquivo_path, blob }, await chavePdf(mapa)); }
  catch { /* File still accessible online; local storage may be full. */ }
}

export async function baixarMapaPdf(mapa: MapaPdf): Promise<ArquivoGerado> {
  let local: { versao: string; path: string; blob: Blob } | undefined;
  try { local = await idb.get("cache", await chavePdf(mapa)); } catch { /* cache unavailable */ }
  if (local?.versao === mapa.atualizado_em && local.path === mapa.arquivo_path) return { blob: local.blob, nome: mapa.nome_arquivo };
  if (!navigator.onLine) throw new Error("Abra este mapa uma vez com internet neste aparelho para usá-lo offline");
  const { data, error } = await supabase.storage.from(MAPA_PDF_BUCKET).download(mapa.arquivo_path);
  if (error || !data) throw new Error(`Não foi possível carregar o PDF: ${error?.message ?? "arquivo indisponível"}`);
  const blob = data.type === "application/pdf" ? data : new Blob([data], { type: "application/pdf" });
  await guardarPdfLocal(mapa, blob);
  return { blob, nome: mapa.nome_arquivo };
}

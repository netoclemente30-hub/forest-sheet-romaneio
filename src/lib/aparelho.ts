// Identificação do aparelho nos registros: nome amigável (configurável) + modelo detectado.
// Browser-only nas funções que usam navigator/localStorage.

import { supabase } from "@/integrations/supabase/client";

const CHAVE_NOME = "aparelho-nome";
const CHAVE_MODELO = "aparelho-modelo";

export interface Aparelho { aparelho_nome: string | null; aparelho_modelo: string | null; aparelho_ua: string | null }

// Extrai um modelo legível do user agent (ex.: "Android 13 · 23043RP34G", "iPhone", "Windows · Chrome").
export function modeloDoUserAgent(ua: string): string {
  const navegador = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  const android = ua.match(/Android\s([\d.]+)?;?\s*([^;)]*)/);
  if (android) {
    const modelo = android[2]?.trim().replace(/\sBuild\/.*/, "");
    const partes = [`Android${android[1] ? " " + android[1] : ""}`];
    if (modelo && modelo !== "K" && !/^wv$/.test(modelo)) partes.push(modelo);
    if (navegador) partes.push(navegador);
    return partes.join(" · ");
  }
  if (/iPad/.test(ua)) return ["iPad", navegador].filter(Boolean).join(" · ");
  if (/iPhone/.test(ua)) return ["iPhone", navegador].filter(Boolean).join(" · ");
  const so = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Aparelho";
  return [so, navegador].filter(Boolean).join(" · ");
}

export function nomeAparelho(): string | null {
  try { return localStorage.getItem(CHAVE_NOME) || null; } catch { return null; }
}

// Usa o modelo real informado pelo Chrome (userAgentData) quando disponível; guarda em cache.
export async function detectarModelo(): Promise<string> {
  const ua = navigator.userAgent;
  let modelo = modeloDoUserAgent(ua);
  try {
    const uad = (navigator as Navigator & { userAgentData?: { getHighEntropyValues: (h: string[]) => Promise<{ model?: string; platform?: string; platformVersion?: string }> } }).userAgentData;
    if (uad) {
      const v = await uad.getHighEntropyValues(["model", "platform", "platformVersion"]);
      if (v.model) modelo = [v.platform, v.model].filter(Boolean).join(" · ") + (modelo.includes("Chrome") ? " · Chrome" : "");
    }
    localStorage.setItem(CHAVE_MODELO, modelo);
  } catch {
    try { return localStorage.getItem(CHAVE_MODELO) || modelo; } catch { /* sem storage */ }
  }
  return modelo;
}

export async function aparelhoAtual(): Promise<Aparelho> {
  if (typeof navigator === "undefined") return { aparelho_nome: null, aparelho_modelo: null, aparelho_ua: null };
  return { aparelho_nome: nomeAparelho(), aparelho_modelo: await detectarModelo(), aparelho_ua: navigator.userAgent };
}

// Salva o nome neste aparelho e na nuvem (para que operações gravadas pelo servidor também o mostrem).
export async function salvarNomeAparelho(nome: string): Promise<void> {
  const limpo = nome.trim().slice(0, 60);
  if (limpo) localStorage.setItem(CHAVE_NOME, limpo); else localStorage.removeItem(CHAVE_NOME);
  if (!limpo || !navigator.onLine) return;
  const modelo = await detectarModelo();
  const { error } = await supabase.from("aparelhos").upsert({ user_agent: navigator.userAgent, nome: limpo, modelo, atualizado_em: new Date().toISOString() }, { onConflict: "empresa_id,user_agent" });
  if (error) console.warn("Falha ao salvar aparelho:", error.message);
}

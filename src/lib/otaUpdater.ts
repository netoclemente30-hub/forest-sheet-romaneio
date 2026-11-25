import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { toast } from "sonner";

const REPO = "https://github.com/netoclemente30-hub/forest-sheet-romaneio";
const VERSION_URL = REPO + "/releases/latest/download/version.json";
const versionPattern = /^\d{1,9}\.\d{1,9}\.\d{1,9}$/;
let verificacao: Promise<void> | undefined;
let versaoAtiva: Promise<string> | undefined;

export function lerVersaoAndroid() {
  versaoAtiva ??= CapacitorUpdater.current().then(({ native, bundle }) =>
    bundle.id === "builtin" ? `v${native}` : `v${native} • OTA #${bundle.version}`,
  ).catch((erro: unknown) => {
    versaoAtiva = undefined;
    throw erro;
  });
  return versaoAtiva;
}

function avisarAtualizacao(id: string) {
  toast.success("Nova versão do Gestor Florestal baixada. Reinicie o app para aplicar.", {
    id: "atualizacao-ota",
    duration: 12_000,
    action: {
      label: "Atualizar agora",
      onClick: () => {
        void CapacitorUpdater.set({ id }).catch(() => {
          toast.error("Não foi possível aplicar a atualização agora. Reinicie o app para tentar novamente.");
        });
      },
    },
  });
}

function maisNova(candidata: string, atual: string): boolean {
  const partes = atual.split(".").map(Number);
  for (const [i, parte] of candidata.split(".").map(Number).entries()) {
    const diferenca = parte - (partes[i] ?? 0);
    if (diferenca !== 0) return diferenca > 0;
  }
  return false;
}

async function verificar() {
  await CapacitorUpdater.notifyAppReady();
  if (!navigator.onLine) return;

  // A requisição nativa segue o redirecionamento do GitHub sem depender de CORS.
  const res = await CapacitorHttp.get({
    url: VERSION_URL, responseType: "json", headers: { "Cache-Control": "no-cache" },
    connectTimeout: 8_000, readTimeout: 8_000,
  });
  if (res.status !== 200) return;

  const manifest = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
  const { version, url, checksum, nativeVersion } = manifest ?? {};
  if (typeof version !== "string" || !versionPattern.test(version) ||
      url !== REPO + "/releases/download/ota-" + version + "/web-bundle.zip" ||
      typeof checksum !== "string" || !/^[a-f0-9]{64}$/i.test(checksum)) return;

  const [atual, agendado] = await Promise.all([
    CapacitorUpdater.current(), CapacitorUpdater.getNextBundle(),
  ]);
  if (nativeVersion !== atual.native) return;
  const instalada = versionPattern.test(atual.bundle.version) ? atual.bundle.version : "0.0.0";
  const embarcada = import.meta.env["VITE_ANDROID_BUNDLE_VERSION"] || "0.0.0";
  if (!maisNova(version, instalada) || !maisNova(version, embarcada) ||
      (agendado && !maisNova(version, agendado.version))) return;

  const bundle = await CapacitorUpdater.download({ url, version, checksum });
  await CapacitorUpdater.next({ id: bundle.id });
  avisarAtualizacao(bundle.id);
}

export function verificarAtualizacaoOTA() {
  if (!Capacitor.isNativePlatform()) return;
  verificacao ??= verificar().catch((error: unknown) => {
    console.warn("Falha ao verificar atualização OTA", error instanceof Error ? error.message : "");
  });
}

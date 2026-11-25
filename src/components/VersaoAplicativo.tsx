import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";
import { version } from "../../package.json";

declare const __BUILD_APP__: string;

export function VersaoAplicativo() {
  const [versao, setVersao] = useState<string>();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let ativo = true;
    void import("@/lib/otaUpdater")
      .then(({ lerVersaoAndroid }) => lerVersaoAndroid())
      .then((valor) => { if (ativo) setVersao(valor); })
      .catch(() => { if (ativo) setVersao("Versão indisponível"); });
    return () => { ativo = false; };
  }, []);

  const hash = typeof __BUILD_APP__ === "string" ? __BUILD_APP__ : "";
  const versaoWeb = hash ? `v${version} • ${hash}` : `v${version}`;
  // Keep the prerendered markup consistent until the native bridge returns the version.
  const texto = versao ?? versaoWeb;
  return <span className="text-[10px] tabular-nums text-muted-foreground" aria-label={`Versão do aplicativo: ${texto}`}>{texto}</span>;
}

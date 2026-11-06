import { useEffect, useState } from "react";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [ios, setIos] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const update = () => setInstalled(standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const available = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const completed = () => { setInstalled(true); setPrompt(null); setHelpOpen(false); };
    update();
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    setPreview(!import.meta.env.PROD || window.self !== window.top);
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", completed);
    standalone.addEventListener("change", update);
    return () => {
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", completed);
      standalone.removeEventListener("change", update);
    };
  }, []);

  async function install() {
    if (installed || busy) return;
    if (!prompt) { setHelpOpen(true); return; }
    setBusy(true);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      setHelpOpen(true);
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  }

  return { installed, busy, helpOpen, setHelpOpen, ios, preview, install };
}
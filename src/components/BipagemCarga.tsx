import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { QrScanner } from "./QrScanner";
import { Button } from "./ui/button";

export function BipagemCarga({ onScan }: { onScan: (codigo: string) => string | null }) {
  const [aberta, setAberta] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => () => {
    const ctx = audio.current;
    audio.current = null;
    void ctx?.close().catch(() => {});
  }, []);

  function abrir() {
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume().catch(() => {});
    } catch { /* a leitura continua disponível sem áudio */ }
    setMensagem("");
    setAberta(true);
  }

  function ler(codigo: string) {
    const aviso = onScan(codigo);
    setMensagem(aviso ?? "Item adicionado à carga.");
    if (aviso) return;
    navigator.vibrate?.(55);
    const ctx = audio.current;
    if (!ctx || ctx.state !== "running") return;
    const som = ctx.createOscillator();
    const ganho = ctx.createGain();
    som.frequency.value = 950;
    ganho.gain.value = 0.13;
    som.connect(ganho).connect(ctx.destination);
    som.start();
    som.stop(ctx.currentTime + 0.11);
    som.onended = () => { som.disconnect(); ganho.disconnect(); };
  }

  return <div className="space-y-2">
    <Button type="button" variant="outline" onClick={aberta ? () => setAberta(false) : abrir}>
      <Camera />{aberta ? "Finalizar bipagem" : "Bipar Carga (Leitura Contínua)"}
    </Button>
    {aberta && <QrScanner onScan={ler} onClose={() => { setAberta(false); setMensagem("Não foi possível abrir a câmera."); }} />}
    {mensagem && <p role="status" className="text-sm text-muted-foreground">{mensagem}</p>}
  </div>;
}

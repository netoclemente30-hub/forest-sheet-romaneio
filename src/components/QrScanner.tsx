import { Capacitor } from "@capacitor/core";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function QrScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const id = useId();
  const nativo = Capacitor.isNativePlatform();
  const last = useRef({ t: "", at: 0 });
  const cb = useRef(onScan);
  const fechar = useRef(onClose);
  const [erro, setErro] = useState("");
  const [fotografando, setFotografando] = useState(false);
  const ativo = useRef(false);
  cb.current = onScan;
  fechar.current = onClose;

  useEffect(() => {
    let cancelado = false;
    ativo.current = true;
    let scanner: import("html5-qrcode").Html5Qrcode | undefined;
    const iniciar = async () => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (cancelado) return;
      scanner = new Html5Qrcode(id, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
        useBarCodeDetectorIfSupported: !nativo,
      });
      const options = {
        fps: 12,
        qrbox: (w: number, h: number) => {
          const n = Math.floor(Math.min(w, h) * 0.85);
          return { width: n, height: n };
        },
      };
      const ler = (text: string) => {
        if (cancelado) return;
        const now = Date.now();
        if (text === last.current.t && now - last.current.at < 2500) return;
        last.current = { t: text, at: now };
        cb.current(text);
      };
      await scanner.start({ facingMode: "environment" }, options, ler, () => {});
    };
    const liberar = async () => {
      if (scanner?.isScanning) await scanner.stop();
      scanner?.clear();
    };
    const pronto = iniciar().catch(async (falha: unknown) => {
      if (cancelado) return;
      await liberar().catch(() => {});
      if (cancelado) return;
      if (!nativo) { fechar.current(); return; }
      console.warn("Falha ao iniciar câmera QR", falha);
      setErro("Não foi possível iniciar o vídeo. Você pode fotografar o QR ou digitar o código.");
    });
    return () => {
      cancelado = true;
      ativo.current = false;
      void pronto.then(liberar).catch(() => {});
    };
  }, [id, nativo]);

  async function lerFoto() {
    setFotografando(true);
    try {
      const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
      const foto = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
        quality: 85,
        saveToGallery: false,
      });
      if (!ativo.current) return;
      if (!foto.webPath) throw new Error("Foto indisponível.");
      const resposta = await fetch(foto.webPath);
      if (!resposta.ok) throw new Error("Não foi possível ler a foto.");
      const blob = await resposta.blob();
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (!ativo.current) return;
      const scanner = new Html5Qrcode(id, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
        useBarCodeDetectorIfSupported: false,
      });
      let codigo: string;
      try {
        codigo = await scanner.scanFile(new File([blob], "qr." + foto.format, { type: blob.type }), false);
      } finally {
        if (ativo.current) scanner.clear();
      }
      if (ativo.current) cb.current(codigo);
    } catch (falha) {
      if (!ativo.current) return;
      const mensagem = falha instanceof Error ? falha.message : String(falha);
      if (!/cancel/i.test(mensagem)) {
        setErro("Não foi possível ler o QR na foto. Confira a permissão da câmera e enquadre o código inteiro.");
      }
    } finally {
      if (ativo.current) setFotografando(false);
    }
  }

  return (
    <div className="space-y-2">
      <div id={id} className="w-full overflow-hidden rounded-xl bg-foreground" />
      {erro && <p role="alert" className="text-sm">{erro}</p>}
      {nativo && erro && (
        <Button type="button" variant="outline" disabled={fotografando} onClick={() => void lerFoto()}>
          {fotografando ? "Abrindo câmera…" : "Fotografar QR Code"}
        </Button>
      )}
    </div>
  );
}

import { useEffect, useRef } from "react";

export function QrScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const last = useRef<{ t: string; at: number }>({ t: "", at: 0 });
  const cb = useRef(onScan);
  const fechar = useRef(onClose);
  cb.current = onScan;
  fechar.current = onClose;
  // Inicia a câmera uma única vez; callbacks vêm por ref para não reiniciar a cada render.
  useEffect(() => {
    let cancel = false;
    let iniciou: Promise<unknown> | null = null;
    let scanner: { stop: () => Promise<void>; clear: () => void; isScanning?: boolean } | null = null;
    import("html5-qrcode").then(({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
      if (cancel) return;
      const s = new Html5Qrcode("qr-reader", { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false, useBarCodeDetectorIfSupported: true });
      scanner = s;
      iniciou = s.start(
        { facingMode: "environment" },
        { fps: 12, qrbox: (w: number, h: number) => { const n = Math.floor(Math.min(w, h) * 0.85); return { width: n, height: n }; } },
        (text) => {
          const now = Date.now();
          if (text === last.current.t && now - last.current.at < 2500) return;
          last.current = { t: text, at: now };
          cb.current(text);
        },
        () => {},
      ).catch(() => { if (!cancel) fechar.current(); });
    }).catch(() => { if (!cancel) fechar.current(); });
    return () => {
      cancel = true;
      Promise.resolve(iniciou).then(() => scanner?.stop()).then(() => scanner?.clear()).catch(() => {});
    };
  }, []);
  return <div id="qr-reader" className="w-full overflow-hidden rounded-xl bg-foreground" />;
}

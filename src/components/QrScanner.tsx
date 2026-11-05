import { useEffect, useRef } from "react";

export function QrScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const last = useRef<{ t: string; at: number }>({ t: "", at: 0 });
  const cb = useRef(onScan);
  cb.current = onScan;
  useEffect(() => {
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let cancel = false;
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancel) return;
      const s = new Html5Qrcode("qr-reader");
      scanner = s;
      s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (text) => {
          const now = Date.now();
          if (text === last.current.t && now - last.current.at < 2500) return;
          last.current = { t: text, at: now };
          cb.current(text);
        },
        () => {},
      ).catch(() => onClose());
    });
    return () => {
      cancel = true;
      scanner?.stop().then(() => scanner?.clear()).catch(() => {});
    };
  }, [onClose]);
  return <div id="qr-reader" className="w-full overflow-hidden rounded-xl bg-foreground" />;
}

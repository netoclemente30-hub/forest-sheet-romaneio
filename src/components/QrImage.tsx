import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrImage({ value, size = 160 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: size * 2 }).then(setSrc);
  }, [value, size]);
  return src ? <img src={src} width={size} height={size} alt={`QR ${value}`} /> : <div style={{ width: size, height: size }} />;
}

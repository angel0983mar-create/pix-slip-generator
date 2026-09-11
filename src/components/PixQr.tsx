import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function usePixQr(payload: string | null | undefined) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!payload) {
      setDataUrl(null);
      return;
    }
    QRCode.toDataURL(payload, { width: 640, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [payload]);

  return dataUrl;
}

export function PixQr({ payload, className }: { payload: string | null; className?: string }) {
  const dataUrl = usePixQr(payload);
  if (!dataUrl) return null;
  return (
    <img
      src={dataUrl}
      alt="QR Code para pagamento via Pix"
      className={className ?? "size-56 rounded-xl bg-white p-3"}
    />
  );
}

import { DownloadIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { QrCode } from "@/components/ui/qr-code";
import { downloadQrPng } from "@/lib/share-image";

interface ShareQrPanelProps {
  url: string;
  label: string;
  filenameBase: string;
}

/** The share link as a bare, downloadable QR code; the image render and binder sheet embed one inside more artwork. */
export function ShareQrPanel({ url, label, filenameBase }: ShareQrPanelProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    const base = filenameBase.replaceAll(/[^\w -]+/gu, "_").trim() || "qr-code";
    setDownloading(true);
    try {
      await downloadQrPng(url, `${base}-qr.png`);
      setDownloading(false);
    } catch {
      // Not a mutation, so it never reaches the global mutation error handler.
      setDownloading(false);
      toast.error("Couldn't prepare the QR code. Please try again.");
    }
  };

  return (
    <div className="flex flex-col items-start gap-4">
      <QrCode value={url} size={200} label={label} />
      <Button variant="outline" onClick={() => void handleDownload()} disabled={downloading}>
        {downloading ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
        Download PNG
      </Button>
    </div>
  );
}

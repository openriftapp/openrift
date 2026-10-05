import { QrCodeIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CopyField } from "@/components/ui/copy-field";
import { QrCode } from "@/components/ui/qr-code";
import { m } from "@/paraglide/messages.js";

interface ShareLinkRowProps {
  url: string;
  label: string;
  defaultQrOpen?: boolean;
  hideQr?: boolean;
  actions?: ReactNode;
}

export function ShareLinkRow({
  url,
  label,
  defaultQrOpen = false,
  hideQr = false,
  actions,
}: ShareLinkRowProps) {
  const [qrOpen, setQrOpen] = useState(defaultQrOpen);

  return (
    <div className="flex flex-col gap-2">
      <CopyField value={url} aria-label={label} className="flex-wrap" inputClassName="min-w-48">
        {hideQr ? null : (
          <Button
            variant="outline"
            size="icon"
            aria-expanded={qrOpen}
            aria-label={qrOpen ? m.share_link_qr_hide() : m.share_link_qr_show()}
            onClick={() => setQrOpen(!qrOpen)}
          >
            <QrCodeIcon />
          </Button>
        )}
        {actions}
      </CopyField>
      {qrOpen && !hideQr ? (
        <QrCode value={url} label={m.share_link_qr_label({ label: label.toLowerCase() })} />
      ) : null}
    </div>
  );
}

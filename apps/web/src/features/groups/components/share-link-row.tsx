import { CheckIcon, CopyIcon, QrCodeIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode } from "@/components/ui/qr-code";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { m } from "@/paraglide/messages.js";

interface ShareLinkRowProps {
  url: string;
  label: string;
  defaultQrOpen?: boolean;
  hideQr?: boolean;
  actions?: ReactNode;
}

/**
 * The canonical way to present a share link: the URL in a read-only field, a
 * Copy button that confirms inline, and the same QR affordance everywhere.
 */
export function ShareLinkRow({
  url,
  label,
  defaultQrOpen = false,
  hideQr = false,
  actions,
}: ShareLinkRowProps) {
  const { copied, copy } = useCopyToClipboard();
  const [qrOpen, setQrOpen] = useState(defaultQrOpen);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={url}
          readOnly
          aria-label={label}
          className="min-w-48 flex-1"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button variant="outline" onClick={() => void copy(url)}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? m.common_copied() : m.common_copy()}
        </Button>
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
      </div>
      {qrOpen && !hideQr ? (
        <QrCode value={url} label={m.share_link_qr_label({ label: label.toLowerCase() })} />
      ) : null}
    </div>
  );
}

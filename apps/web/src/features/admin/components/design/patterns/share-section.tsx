import { Button } from "@/components/ui/button";
import { CopyField } from "@/components/ui/copy-field";
import { QrCode } from "@/components/ui/qr-code";
import {
  DemoGroup,
  DemoRow,
  DemoSection,
  Swatch,
  SwatchRow,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { ShareLinkRow } from "@/features/groups/components/share-link-row";
import { chatLookupUrl } from "@/lib/creator-chat-commands";
import { getSiteUrl } from "@/lib/site-config";

const GROUPS = {
  copyField: { id: "share-copy-field", title: "CopyField" },
  qr: { id: "share-qr", title: "QrCode" },
  shareLink: { id: "share-share-link", title: "ShareLinkRow" },
} as const;

export const SHARE_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

const DEMO_SHARE_PATH = "/lists/share/AbCdEf123456";

export function ShareSection() {
  const siteUrl = getSiteUrl();
  const demoShareUrl = `${siteUrl}${DEMO_SHARE_PATH}`;
  const nightbotCommand = `!addcom !card $(urlfetch ${chatLookupUrl(siteUrl)}?q=$(querystring))`;

  return (
    <DemoSection
      id="share"
      title="Copy & share"
      note="The read-only value rows, and the share-link form of them that carries a QR."
      docs="components/ui/copy-field.tsx · components/ui/qr-code.tsx · features/groups/components/share-link-row.tsx"
    >
      <DemoGroup
        {...GROUPS.copyField}
        hint="For anything copied verbatim that is not a share link. mono is for a value read character by character before pasting."
      >
        <DemoRow label="Values" className="flex-col items-stretch">
          <CopyField value="RIFT-2026-OGN" label="Deck code" />
          <CopyField value={nightbotCommand} label="Nightbot command" mono />
        </DemoRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.qr}
        hint="Every QR goes through this component for the white plate, which is what keeps the code scannable in dark mode."
      >
        <SwatchRow label="Sizes" hint="224 suits a code meant to be scanned across a table.">
          <Swatch label="160 (default)">
            <QrCode value={demoShareUrl} />
          </Swatch>
          <Swatch label="224">
            <QrCode value={demoShareUrl} size={224} />
          </Swatch>
        </SwatchRow>
      </DemoGroup>
      <DemoGroup {...GROUPS.shareLink}>
        <DemoRow label="Collapsed" className="flex-col items-stretch">
          <ShareLinkRow url={demoShareUrl} label="Share link" />
        </DemoRow>
        <DemoRow
          label="Expanded, with an action"
          hint="Full pages pass defaultQrOpen so an organizer can leave the code on screen."
          className="flex-col items-stretch"
        >
          <ShareLinkRow
            url={demoShareUrl}
            label="Registration link"
            defaultQrOpen
            actions={<Button variant="ghost">Disable</Button>}
          />
        </DemoRow>
      </DemoGroup>
    </DemoSection>
  );
}

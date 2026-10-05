import { ShareLinkRow } from "@/components/share/share-link-row";
import { Button } from "@/components/ui/button";
import {
  DemoGroup,
  DemoRow,
  DemoSection,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { getSiteUrl } from "@/lib/site-config";

const GROUPS = {
  shareLink: { id: "share-share-link", title: "ShareLinkRow" },
} as const;

export const SHARE_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

const DEMO_SHARE_PATH = "/lists/share/AbCdEf123456";

export function ShareSection() {
  const siteUrl = getSiteUrl();
  const demoShareUrl = `${siteUrl}${DEMO_SHARE_PATH}`;

  return (
    <DemoSection
      id="share"
      title="Copy & share"
      note="The share-link row with its QR. The bare CopyField and QrCode are under Components."
      docs="components/share/share-link-row.tsx"
    >
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

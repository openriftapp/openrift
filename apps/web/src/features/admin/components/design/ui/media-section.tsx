import { ImageOffIcon } from "lucide-react";

import { CopyField } from "@/components/ui/copy-field";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { QrCode } from "@/components/ui/qr-code";
import {
  Demo,
  DemoGrid,
  DemoGroup,
  DemoRow,
  DemoSection,
  Swatch,
  SwatchRow,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { chatLookupUrl } from "@/lib/creator-chat-commands";
import { getSiteUrl } from "@/lib/site-config";

const GROUPS = {
  img: { id: "media-img-with-fallback", title: "ImgWithFallback" },
  copyField: { id: "media-copy-field", title: "CopyField" },
  qr: { id: "media-qr", title: "QrCode" },
} as const;

export const MEDIA_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

const DEMO_SHARE_PATH = "/lists/share/AbCdEf123456";

function ImageFallback() {
  return (
    <span className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-md">
      <ImageOffIcon className="size-5" />
    </span>
  );
}

export function MediaSection() {
  const siteUrl = getSiteUrl();
  const demoShareUrl = `${siteUrl}${DEMO_SHARE_PATH}`;
  const nightbotCommand = `!addcom !card $(urlfetch ${chatLookupUrl(siteUrl)}?q=$(querystring))`;

  return (
    <DemoSection
      id="media"
      title="Images, codes & copy"
      note="Images that may be missing, and values meant to be copied or scanned."
      docs="components/ui/img-with-fallback.tsx · copy-field.tsx · qr-code.tsx"
    >
      <DemoGroup
        {...GROUPS.img}
        hint="An image that may 404 renders its fallback, so a broken image looks the same as a missing one."
      >
        <DemoGrid>
          <Demo name="Loaded" hint="The source exists.">
            <ImgWithFallback
              src="/images/rarities/epic.webp"
              alt="Epic"
              className="size-16 rounded-md object-contain"
              fallback={<ImageFallback />}
            />
          </Demo>
          <Demo name="Fallback" hint="The source is missing.">
            <ImgWithFallback
              src="/images/missing-demo.webp"
              alt="Missing"
              className="size-16 rounded-md"
              fallback={<ImageFallback />}
            />
          </Demo>
        </DemoGrid>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.copyField}
        hint="For anything copied verbatim that is not a share link. mono is for a value read character by character before pasting."
      >
        <DemoRow label="Values" className="flex-col items-stretch">
          <CopyField value="RIFT-2026-OGN" aria-label="Deck code" />
          <CopyField value={nightbotCommand} aria-label="Nightbot command" mono />
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
    </DemoSection>
  );
}

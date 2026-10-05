import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link } from "@tanstack/react-router";
import { SmartphoneIcon } from "lucide-react";
import type { ReactNode } from "react";

import { SiteBannerStrip } from "@/components/layout/site-banner-strip";
import { TextLink } from "@/components/ui/text-link";
import { m } from "@/paraglide/messages.js";
import { useInstallStore } from "@/stores/install-store";

export function InstallNudge() {
  const dismissNudge = useInstallStore((state) => state.dismissNudge);

  return (
    <SiteBannerStrip
      icon={<SmartphoneIcon />}
      dismissLabel={m.install_nudge_dismiss()}
      onDismiss={dismissNudge}
    >
      <p className="min-w-0 flex-1">
        <ParaglideMessage
          message={m.install_nudge_text}
          markup={{
            b: ({ children }: { children?: ReactNode }) => (
              <span className="font-semibold">{children}</span>
            ),
          }}
        />{" "}
        <TextLink render={<Link to="/install" />} onClick={dismissNudge}>
          {m.install_nudge_link()}
        </TextLink>
      </p>
    </SiteBannerStrip>
  );
}

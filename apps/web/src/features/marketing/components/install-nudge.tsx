import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { todayUtc } from "@openrift/shared/set-release";
import { Link, useLocation } from "@tanstack/react-router";
import { SmartphoneIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  detectInstallPlatform,
  installNudgeVisible,
  isStandaloneDisplay,
} from "@/lib/install-platform";
import { cn, CONTAINER_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useInstallStore } from "@/stores/install-store";

export function InstallNudge() {
  const hydrated = useHydrated();
  const pathname = useLocation({ select: (location) => location.pathname });
  const visitDays = useInstallStore((state) => state.visitDays);
  const dismissed = useInstallStore((state) => state.nudgeDismissed);
  const installedToastShown = useInstallStore((state) => state.installedToastShown);
  const recordVisit = useInstallStore((state) => state.recordVisit);
  const dismissNudge = useInstallStore((state) => state.dismissNudge);
  const markInstalledToastShown = useInstallStore((state) => state.markInstalledToastShown);
  const standalone = hydrated && isStandaloneDisplay();

  useEffect(() => {
    recordVisit(todayUtc());
  }, [recordVisit]);

  useEffect(() => {
    if (standalone && !installedToastShown) {
      markInstalledToastShown();
      toast.success(m.install_toast_title(), { description: m.install_toast_body() });
    }
  }, [standalone, installedToastShown, markInstalledToastShown]);

  if (!hydrated) {
    return null;
  }
  const { os } = detectInstallPlatform(globalThis.navigator.userAgent, navigator.maxTouchPoints);
  if (!installNudgeVisible({ os, standalone, visitDays, dismissed, pathname })) {
    return null;
  }

  return (
    <div className="bg-primary/10 border-primary/20 relative z-40 border-b">
      <div className={cn(CONTAINER_WIDTH, "px-safe flex items-center gap-3 py-2 text-sm")}>
        <SmartphoneIcon className="text-primary size-4 shrink-0" aria-hidden="true" />
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
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={m.install_nudge_dismiss()}
          onClick={dismissNudge}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}

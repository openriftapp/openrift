import { todayUtc } from "@openrift/shared/format-date";
import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";

import { useHydrated } from "@/hooks/use-hydrated";
import {
  detectInstallPlatform,
  installNudgeVisible,
  isStandaloneDisplay,
} from "@/lib/install-platform";
import { m } from "@/paraglide/messages.js";
import { useInstallStore } from "@/stores/install-store";

/** Whether the install nudge should show. Also records the visit and greets a fresh install. */
export function useInstallNudge(): boolean {
  const hydrated = useHydrated();
  const pathname = useLocation({ select: (location) => location.pathname });
  const visitDays = useInstallStore((state) => state.visitDays);
  const dismissed = useInstallStore((state) => state.nudgeDismissed);
  const installedToastShown = useInstallStore((state) => state.installedToastShown);
  const recordVisit = useInstallStore((state) => state.recordVisit);
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
    return false;
  }
  const { os } = detectInstallPlatform(globalThis.navigator.userAgent, navigator.maxTouchPoints);
  return installNudgeVisible({ os, standalone, visitDays, dismissed, pathname });
}

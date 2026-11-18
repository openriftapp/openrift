import { Outlet, useMatches, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { CommandPalette } from "@/components/command-palette/command-palette";
import { AppBackground } from "@/components/layout/app-background";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { SiteBanner } from "@/components/layout/site-banner";
import { usePreferencesSync } from "@/features/account/hooks/use-preferences-sync";
import { TradeCancelConsentHost } from "@/features/groups/components/trade-cancel-consent-host";
import { useIdleAreaPrefetch } from "@/hooks/use-idle-area-prefetch";
import { useSession } from "@/hooks/use-session";
import { routeChromeMode } from "@/lib/chrome-mode";
import { setSentryUser } from "@/lib/report-error";
import { cn, CONTAINER_WIDTH, FOOTER_PADDING_NO_TOP } from "@/lib/utils";
import { useSelectionStore } from "@/stores/selection-store";

export function AppLayout() {
  const { data: session } = useSession();
  usePreferencesSync(Boolean(session?.user));
  useIdleAreaPrefetch(session?.user?.id ?? null);
  useEffect(() => {
    if (session !== undefined) {
      setSentryUser(session?.user?.id ?? null);
    }
  }, [session]);
  const matches = useMatches();
  const hideFooter = matches.some((match) => match.staticData?.hideFooter);
  const bare = routeChromeMode(matches) !== undefined;

  // The selection store is a singleton: a path change clears it in the same
  // transition that mounts the next surface. Filters live in search, so those keep it.
  const router = useRouter();
  useEffect(
    () =>
      router.subscribe("onBeforeRouteMount", (event) => {
        if (event.pathChanged) {
          useSelectionStore.getState().closeDetail();
        }
      }),
    [router],
  );

  if (bare) {
    return (
      <>
        <CommandPalette />
        <TradeCancelConsentHost />
        <Outlet />
      </>
    );
  }

  return (
    <>
      <AppBackground />
      <Header />
      <SiteBanner />
      <CommandPalette />
      <TradeCancelConsentHost />
      <main className={cn("flex min-h-0 flex-1 flex-col", CONTAINER_WIDTH)}>
        <div className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
        {!hideFooter && <Footer className={FOOTER_PADDING_NO_TOP} />}
      </main>
    </>
  );
}

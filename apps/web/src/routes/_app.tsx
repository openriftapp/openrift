import { createFileRoute, Outlet, useLocation, useMatches } from "@tanstack/react-router";
import { useEffect } from "react";

import { CommandPalette } from "@/components/command-palette/command-palette";
import { AppBackground } from "@/components/layout/app-background";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { usePreferencesSync } from "@/features/account/hooks/use-preferences-sync";
import { useIdleAreaPrefetch } from "@/hooks/use-idle-area-prefetch";
import { useScopeEffect } from "@/hooks/use-scope-effect";
import { sessionQueryOptions, useSession } from "@/lib/auth-session";
import { setSentryUser } from "@/lib/report-error";
import { cn, CONTAINER_WIDTH, FOOTER_PADDING_NO_TOP } from "@/lib/utils";
import { useSelectionStore } from "@/stores/selection-store";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    // Preload session so the Header can render auth-dependent UI during SSR.
    // Non-critical: if it fails, the client-side useQuery will retry.
    await context.queryClient
      .query({ ...sessionQueryOptions(), staleTime: "static" })
      .catch(() => null);
  },
  component: AppLayout,
});

function AppLayout() {
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

  // The selection store is a singleton, so without this a printing selected
  // on one surface re-appears in the next surface's detail pane.
  const pathname = useLocation({ select: (loc) => loc.pathname });
  useScopeEffect(pathname, () => {
    useSelectionStore.getState().closeDetail();
  });

  return (
    <>
      <AppBackground />
      <Header />
      <CommandPalette />
      <main className={cn("flex min-h-0 flex-1 flex-col", CONTAINER_WIDTH)}>
        <div className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
        {!hideFooter && <Footer className={FOOTER_PADDING_NO_TOP} />}
      </main>
    </>
  );
}

import { createLazyFileRoute } from "@tanstack/react-router";

import { PlayriftboundSyncPage } from "@/features/tournaments/components/playriftbound-sync-page";

export const Route = createLazyFileRoute("/_app/_authenticated/tournaments_/playriftbound-sync")({
  component: PlayriftboundSyncPage,
});

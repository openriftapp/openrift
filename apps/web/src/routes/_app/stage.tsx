import { createFileRoute } from "@tanstack/react-router";

import { PagePending } from "@/components/page-pending";
import { catalogQueryOptions } from "@/features/cards/lib/catalog-queries";
import { stageBuilderSearchSchema } from "@/features/stage/lib/stage-search";
import { initQueryOptions } from "@/lib/init-queries";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/stage")({
  // The queue and the OBS panel read client-held stores through live queries.
  ssr: false,
  // Deliberately not indexed: a stage URL is a working link for one creator's
  // recording session, not a page anyone should land on from search.
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Stage",
      description:
        "Put Riftbound cards on screen: a full-screen show for window capture, and a transparent browser source you push cards to in OBS.",
      path: "/stage",
      noIndex: true,
    }),
  // A URL that opens the show is sent on to /stage/show by the `_app` gate.
  validateSearch: stageBuilderSearchSchema,
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query({ ...catalogQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
    ]);
    return null;
  },
  pendingComponent: PagePending,
});

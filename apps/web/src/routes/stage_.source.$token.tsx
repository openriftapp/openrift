import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/mini";

import { RouteErrorFallback } from "@/components/error-message";
import { catalogQueryOptions } from "@/features/cards/lib/catalog-queries";
import { initQueryOptions } from "@/lib/init-queries";
import { lenient } from "@/lib/lenient-param";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/stage_/source/$token")({
  // Outside `_app` on purpose: this is the OBS browser source, so it carries no
  // header, footer or background. The token in the path is the only guard, so it's noindexed.
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Stage source",
      noIndex: true,
    }),
  // Falls back to undefined on a bad value: a browser source is added once and left
  // alone for months, and a typo in the URL must not break it.
  validateSearch: z.object({
    preset: lenient(z.string()),
  }),
  loader: async ({ context }) => {
    // initQueryOptions is a suspending read, so it must be resolved before the canvas mounts.
    await Promise.all([
      context.queryClient.query({ ...catalogQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
    ]);
    return null;
  },
  errorComponent: RouteErrorFallback,
});

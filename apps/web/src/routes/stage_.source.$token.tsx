import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/mini";

import { catalogQueryOptions } from "@/features/cards/lib/catalog-queries";
import { initQueryOptions } from "@/lib/init-queries";
import { lenient } from "@/lib/lenient-param";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/stage_/source/$token")({
  // Outside `_app`: the OBS browser source carries no header or footer. No backdrop-filter
  // anywhere under this route, it frosts the transparent page into a grey box.
  staticData: { chrome: "transparent" },
  // The token in the path is the only guard, so it's noindexed.
  head: () => privateSeoHead("Stage source"),
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
});

import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { catalogQueryOptions } from "@/features/cards/lib/catalog-queries";
import { metaEventPageQueryOptions, metaSubmitEventQuery } from "@/features/meta/lib/meta-queries";
import { initQueryOptions } from "@/lib/init-queries";
import { privateSeoHead } from "@/lib/seo";

/**
 * Entry point for a decklist without a slug; `/meta/$slug/submit` requires
 * one that a submission-only proposal doesn't have.
 */
export const Route = createFileRoute("/_app/_authenticated/meta_/submit")({
  ssr: "data-only",
  head: () => privateSeoHead("Send a decklist"),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
      context.queryClient.query({
        ...metaEventPageQueryOptions(metaSubmitEventQuery()),
        staleTime: "static",
      }),
      // The catalog turns a pasted deck code's short codes into the card names
      // the submission endpoint takes.
      context.queryClient.query({ ...catalogQueryOptions, staleTime: "static" }),
    ]);
  },
  errorComponent: RouteErrorFallback,
});

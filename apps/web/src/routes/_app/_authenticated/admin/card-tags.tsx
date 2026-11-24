import { createFileRoute } from "@tanstack/react-router";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import {
  adminCardTagsQueryOptions,
  adminTagCategoriesQueryOptions,
  adminTagTranslationsQueryOptions,
} from "@/features/cards/lib/card-tags-queries";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/card-tags")({
  head: () => adminSeoHead("Card Tags"),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query({ ...adminCardTagsQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...adminTagCategoriesQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...adminTagTranslationsQueryOptions, staleTime: "static" }),
    ]),
  pendingComponent: AdminPending,
});

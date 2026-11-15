import { createFileRoute } from "@tanstack/react-router";

import { loansQueryOptions } from "@/features/groups/lib/loans-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/loans")({
  ssr: "data-only",
  head: () => privateSeoHead("Lending"),
  loader: async ({ context }) => {
    await context.queryClient.query({ ...loansQueryOptions(context.userId), staleTime: "static" });
  },
});

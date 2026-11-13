import { createFileRoute } from "@tanstack/react-router";

import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/contribute_/fix")({
  head: () => privateSeoHead("Fix something on a card"),
});

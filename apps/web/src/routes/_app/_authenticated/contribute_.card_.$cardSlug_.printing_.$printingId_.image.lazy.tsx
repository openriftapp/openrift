import { createLazyFileRoute } from "@tanstack/react-router";

import { ImageSuggestPage } from "@/features/contribute/components/image-suggest-page";

export const Route = createLazyFileRoute(
  "/_app/_authenticated/contribute_/card_/$cardSlug_/printing_/$printingId_/image",
)({
  component: ImageSuggestPage,
});

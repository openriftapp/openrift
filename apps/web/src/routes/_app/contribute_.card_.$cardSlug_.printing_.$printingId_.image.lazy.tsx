import { createLazyFileRoute } from "@tanstack/react-router";

import { ImageSuggestPage } from "@/features/contribute/components/image-suggest-page";

export const Route = createLazyFileRoute(
  "/_app/contribute_/card_/$cardSlug_/printing_/$printingId_/image",
)({
  component: ImageSuggestPage,
});

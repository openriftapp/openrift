import { createLazyFileRoute } from "@tanstack/react-router";

import { PrintingDeskPostPage } from "@/features/admin/components/printing-desk-post-page";
import { decodePostSlides } from "@/features/admin/lib/printing-post-slides";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/printing-desk_/post")({
  component: PrintingDeskPostRoute,
});

function PrintingDeskPostRoute() {
  const { slides, label, aspect, date } = Route.useSearch();
  return (
    <PrintingDeskPostPage
      slides={decodePostSlides(slides)}
      label={label}
      aspect={aspect}
      date={date}
    />
  );
}

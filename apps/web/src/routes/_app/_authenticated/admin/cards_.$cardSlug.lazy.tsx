import { createLazyFileRoute, useParams, useSearch } from "@tanstack/react-router";

import { ExistingCardDetailPage } from "@/features/admin/components/existing-card-detail-page";

function ExistingCardPage() {
  const { cardSlug } = useParams({ from: "/_app/_authenticated/admin/cards_/$cardSlug" });
  const { section, focusMarketplace, focusFinish, focusLanguage, set, status, priceScope } =
    useSearch({
      from: "/_app/_authenticated/admin/cards_/$cardSlug",
    });
  return (
    <ExistingCardDetailPage
      key={cardSlug}
      identifier={cardSlug}
      section={section}
      focusMarketplace={focusMarketplace}
      focusFinish={focusFinish}
      focusLanguage={focusLanguage}
      setSlug={set}
      listStatus={status}
      priceScope={priceScope}
    />
  );
}

export const Route = createLazyFileRoute("/_app/_authenticated/admin/cards_/$cardSlug")({
  component: ExistingCardPage,
});

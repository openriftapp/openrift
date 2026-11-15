import { getRouteApi } from "@tanstack/react-router";

import { ExistingCardDetailPage } from "@/features/admin/components/existing-card-detail-page";

const routeApi = getRouteApi("/_app/_authenticated/admin/cards_/$cardSlug");

export function ExistingCardPage() {
  const { cardSlug } = routeApi.useParams();
  const {
    section,
    face,
    focusMarketplace,
    focusFinish,
    focusLanguage,
    focusField,
    set,
    status,
    priceScope,
  } = routeApi.useSearch();
  return (
    <ExistingCardDetailPage
      key={cardSlug}
      cardSlug={cardSlug}
      section={section}
      face={face}
      focusMarketplace={focusMarketplace}
      focusFinish={focusFinish}
      focusLanguage={focusLanguage}
      focusField={focusField}
      setSlug={set}
      listStatus={status}
      priceScope={priceScope}
    />
  );
}

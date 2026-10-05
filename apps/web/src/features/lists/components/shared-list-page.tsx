import type { ListIntent } from "@openrift/shared/types/api/list";
import { getRouteApi } from "@tanstack/react-router";

import { PublicShareCta } from "@/components/signed-out-cta";
import { FilterSearchProvider } from "@/features/cards/hooks/use-filter-search";
import { SharedListContent } from "@/features/lists/components/shared-list-content";
import { usePublicList } from "@/features/lists/hooks/use-lists";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/lists_/share/$token");

function ctaForIntent(intent: ListIntent): { title: string; body: string } {
  switch (intent) {
    case "wish": {
      return { title: m.lists_share_cta_wish_title(), body: m.lists_share_cta_wish_body() };
    }
    case "trade": {
      return { title: m.lists_share_cta_trade_title(), body: m.lists_share_cta_trade_body() };
    }
    case "organize": {
      return { title: m.lists_share_cta_organize_title(), body: m.lists_share_cta_organize_body() };
    }
  }
}

export function SharedListPage() {
  const { token } = routeApi.useParams();
  const { data } = usePublicList(token);
  const search = routeApi.useSearch();
  const cta = ctaForIntent(data.list.intent);

  return (
    <FilterSearchProvider value={search}>
      <SharedListContent
        data={data}
        notice={<PublicShareCta title={cta.title}>{cta.body}</PublicShareCta>}
      />
    </FilterSearchProvider>
  );
}

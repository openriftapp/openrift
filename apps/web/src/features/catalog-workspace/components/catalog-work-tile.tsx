import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { InboxIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { hasAdminSection } from "@/features/admin/lib/admin-sections";
import {
  reviewCardsQueryOptions,
  selectReviewQueue,
} from "@/features/catalog-workspace/lib/review-cards";
import { formatCount } from "@/lib/format";

export function CatalogWorkTile() {
  const { data: access } = useAdminAccess();
  const canReview = hasAdminSection(access, "card-review");
  const { data, error } = useQuery({ ...reviewCardsQueryOptions(), enabled: canReview });

  if (!canReview) {
    return null;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground flex items-center gap-1.5">
          <InboxIcon className="size-4" />
          Catalog work
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error === null ? (
          <Link
            to="/admin/workspace/cards"
            search={{ queue: "review" }}
            className="hover:bg-muted/50 flex flex-col gap-0.5 rounded-lg border p-3 sm:w-64"
          >
            <span className="text-sm font-medium">Cards with pending work</span>
            <span className="font-heading text-2xl font-bold">
              {data === undefined
                ? "…"
                : formatCount(selectReviewQueue(data.cards, "review").length)}
            </span>
          </Link>
        ) : (
          <p className="text-muted-foreground text-sm">The review list could not be loaded.</p>
        )}
      </CardContent>
    </Card>
  );
}

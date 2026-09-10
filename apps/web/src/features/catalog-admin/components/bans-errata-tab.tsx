import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";

import { Empty, EmptyDescription } from "@/components/ui/empty";
import { CardBansSection } from "@/features/catalog-admin/components/card-bans-section";
import { CardErrataSection } from "@/features/catalog-admin/components/card-errata-section";

export function BansErrataTab({ detail }: { detail: AdminCardDetailResponse }) {
  const card = detail.card;

  if (card === null) {
    return (
      <Empty>
        <EmptyDescription>
          This name has no card yet, so it can carry neither a ban nor an errata.
        </EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="space-y-8">
      <CardBansSection cardId={card.id} />
      <CardErrataSection cardId={card.id} errata={card.errata} />
    </div>
  );
}

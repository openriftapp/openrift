import type { Printing } from "@openrift/shared/types/catalog";

import { CountWithAddControls } from "@/features/cards/components/count-with-add-controls";
import { useTileOwnedCounts } from "@/features/collections/hooks/use-owned-count";

interface TableCountActionsProps {
  printing: Printing;
  collectionId?: string;
  siblingIds?: readonly string[];
}

export function TableCountActions({ printing, collectionId, siblingIds }: TableCountActionsProps) {
  const { count, totalCount } = useTileOwnedCounts(printing.id, siblingIds, true, collectionId);

  return (
    <CountWithAddControls printing={printing} ownedCount={count} totalOwnedCount={totalCount} />
  );
}

import { countNoun } from "@openrift/shared/strings";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";

import type { PrintingFace } from "@/features/admin/lib/printing-faces";
import { RecordSection } from "@/features/catalog-workspace/components/record/record-pane";

export function PrintingCardLinks({
  faces,
  pendingCount,
}: {
  faces: readonly Pick<PrintingFace, "cardSlug" | "cardName">[];
  pendingCount: number;
}) {
  const cards = [...new Map(faces.map((face) => [face.cardSlug, face])).values()];
  return (
    <RecordSection title={cards.length > 1 ? "Cards" : "Card"}>
      {cards.map((face) => (
        <Link
          key={face.cardSlug}
          to="/admin/workspace/cards/$cardSlug"
          params={{ cardSlug: face.cardSlug }}
          className="mr-3 inline-flex items-center gap-1 underline"
        >
          {face.cardName}
          <ChevronRightIcon className="size-4" />
        </Link>
      ))}
      {pendingCount > 0 && (
        <p className="text-muted-foreground text-sm">
          {countNoun(pendingCount, "suggestion")} pending on this printing
        </p>
      )}
    </RecordSection>
  );
}

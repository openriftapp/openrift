import type { WorkspaceSameDifferenceInput } from "@openrift/shared/contracts/admin/catalog-workspace-bulk";
import { pluralize } from "@openrift/shared/strings";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { CARD_FIELD_LABELS } from "@/features/admin/lib/catalog-field-labels";
import {
  useDiscardSameDifference,
  useSameDifference,
} from "@/features/catalog-workspace/hooks/use-same-difference";

function cardList(names: readonly string[], total: number): string {
  const more = total - names.length;
  return more > 0 ? `${names.join(", ")} and ${more} more` : names.join(", ");
}

export function SameDifferenceLine({
  input,
  sourceLabel,
  value,
}: {
  input: WorkspaceSameDifferenceInput;
  sourceLabel: string;
  value: string;
}) {
  const { data } = useSameDifference(input, true);
  const { discard, isPending } = useDiscardSameDifference();
  const [open, setOpen] = useState(false);

  if (data === undefined || data.count <= 1) {
    return null;
  }
  const { count } = data;
  const fieldLabel = CARD_FIELD_LABELS[input.field].toLowerCase();

  return (
    <>
      <p className="text-muted-foreground basis-full">
        Same difference on {count} cards.{" "}
        <Button
          variant="link"
          size="xs"
          className="h-auto px-0 text-sm"
          onClick={() => setOpen(true)}
        >
          Discard on all {count}
        </Button>
      </p>
      <ConfirmActionDialog
        open={open}
        onOpenChange={setOpen}
        title={`Discard on all ${count} cards?`}
        description={`${sourceLabel} suggests ${fieldLabel} ${value} on ${count} ${pluralize(count, "card")}: ${cardList(
          data.cards.map((card) => card.name),
          count,
        )}. Discarding marks each of those source rows as checked. Undo (Z) brings them all back.`}
        confirmLabel={`Discard on all ${count}`}
        pendingLabel="Discarding…"
        destructive={false}
        isPending={isPending}
        onConfirm={() =>
          discard(input, `${sourceLabel}'s ${fieldLabel} suggestion`, {
            onSuccess: () => setOpen(false),
          })
        }
      />
    </>
  );
}

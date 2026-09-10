import {
  BanIcon,
  CheckIcon,
  CopyCheckIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  MoveIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CompareConfirmDialog,
  ComparePrintingPicker,
} from "@/features/catalog-admin/components/compare-dialogs";
import type {
  CompareActions,
  ComparePrintingTarget,
} from "@/features/catalog-admin/lib/compare-actions";
import type { CompareColumn } from "@/features/catalog-admin/lib/compare-columns";
import type { ComparePrintingBlock } from "@/features/catalog-admin/lib/compare-rows";

type PendingDialog = "move" | "copy" | "ignore" | null;

export function ComparePrintingSourceMenu({
  column,
  block,
  candidatePrintingId,
  targets,
  actions,
}: {
  column: CompareColumn;
  block: ComparePrintingBlock;
  candidatePrintingId: string;
  targets: readonly ComparePrintingTarget[];
  actions: CompareActions;
}) {
  const [pending, setPending] = useState<PendingDialog>(null);
  const otherPrintings = targets.filter((target) => target.id !== block.printingId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" className="shrink-0" />}
          aria-label={`Row actions for ${column.label}`}
        >
          <EllipsisVerticalIcon className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => actions.applyAllFromBlock(block, column.id)}>
            <CopyCheckIcon className="mr-2 size-3.5" />
            Use all values (never images)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => actions.markRowChecked(candidatePrintingId)}>
            <CheckIcon className="mr-2 size-3.5" />
            Mark checked
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={otherPrintings.length === 0}
            onClick={() => setPending("move")}
          >
            <MoveIcon className="mr-2 size-3.5" />
            Move to another printing…
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={otherPrintings.length === 0}
            onClick={() => setPending("copy")}
          >
            <CopyIcon className="mr-2 size-3.5" />
            Copy to another printing…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => actions.unlinkRow(candidatePrintingId)}>
            <XIcon className="mr-2 size-3.5" />
            Unlink from this printing
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPending("ignore")}>
            <BanIcon className="mr-2 size-3.5" />
            Ignore this row
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ComparePrintingPicker
        open={pending === "move"}
        onOpenChange={(open) => setPending(open ? "move" : null)}
        copy={{
          title: "Move this row",
          description: `Pick the printing ${column.label} really describes.`,
          confirmLabel: "Move row",
        }}
        targets={otherPrintings}
        onConfirm={(printingId) => actions.moveRow(candidatePrintingId, printingId)}
      />
      <ComparePrintingPicker
        open={pending === "copy"}
        onOpenChange={(open) => setPending(open ? "copy" : null)}
        copy={{
          title: "Copy this row",
          description: "The row stays where it is and a copy lands on the printing you pick.",
          confirmLabel: "Copy row",
        }}
        targets={otherPrintings}
        onConfirm={(printingId) => actions.copyRow(candidatePrintingId, printingId)}
      />
      <CompareConfirmDialog
        open={pending === "ignore"}
        onOpenChange={(open) => setPending(open ? "ignore" : null)}
        copy={{
          title: "Ignore this row?",
          description: `The row from ${column.label} disappears from this card and stops counting toward review.`,
          confirmLabel: "Ignore row",
        }}
        onConfirm={() => actions.ignoreRow(candidatePrintingId)}
      />
    </>
  );
}

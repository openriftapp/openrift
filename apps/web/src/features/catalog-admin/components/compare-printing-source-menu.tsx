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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CompareConfirmDialog } from "@/features/catalog-admin/components/compare-dialogs";
import type {
  CompareActions,
  ComparePrintingTarget,
} from "@/features/catalog-admin/lib/compare-actions";
import type { CompareColumn } from "@/features/catalog-admin/lib/compare-columns";
import type { ComparePrintingBlock } from "@/features/catalog-admin/lib/compare-rows";

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
  const [ignoring, setIgnoring] = useState(false);
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
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={otherPrintings.length === 0}>
              <MoveIcon className="mr-2 size-3.5" />
              Move to another printing…
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {otherPrintings.map((target) => (
                <DropdownMenuItem
                  key={target.id}
                  onClick={() => actions.moveRow(candidatePrintingId, target.id)}
                >
                  {target.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={otherPrintings.length === 0}>
              <CopyIcon className="mr-2 size-3.5" />
              Copy to another printing…
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {otherPrintings.map((target) => (
                <DropdownMenuItem
                  key={target.id}
                  onClick={() => actions.copyRow(candidatePrintingId, target.id)}
                >
                  {target.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={() => actions.unlinkRow(candidatePrintingId)}>
            <XIcon className="mr-2 size-3.5" />
            Unlink from this printing
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIgnoring(true)}>
            <BanIcon className="mr-2 size-3.5" />
            Ignore this row
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CompareConfirmDialog
        open={ignoring}
        onOpenChange={setIgnoring}
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

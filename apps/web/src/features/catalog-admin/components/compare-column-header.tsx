import { BanIcon, CheckIcon, CopyCheckIcon, EllipsisVerticalIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CompareConfirmDialog } from "@/features/catalog-admin/components/compare-dialogs";
import type { CompareColumn } from "@/features/catalog-admin/lib/compare-columns";
import { cn } from "@/lib/utils";

export function CompareColumnHeader({
  column,
  onUseAll,
  onMarkChecked,
  onHide,
  onIgnore,
}: {
  column: CompareColumn;
  onUseAll: () => void;
  onMarkChecked: () => void;
  onHide: () => void;
  onIgnore: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <th
      scope="col"
      className={cn(
        "w-64 border-l px-3 py-2 text-left align-top font-medium",
        column.isTrusted && "bg-info-soft",
      )}
    >
      <div className="flex items-start gap-1">
        <span className="min-w-0 flex-1 break-words">{column.label}</span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" className="shrink-0" />}
            aria-label={`Actions for ${column.label}`}
          >
            <EllipsisVerticalIcon className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onUseAll}>
              <CopyCheckIcon className="mr-2 size-3.5" />
              Use all values (never images)
            </DropdownMenuItem>
            <DropdownMenuItem disabled={column.isChecked} onClick={onMarkChecked}>
              <CheckIcon className="mr-2 size-3.5" />
              Mark checked
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onHide}>
              <EyeOffIcon className="mr-2 size-3.5" />
              Hide column
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConfirming(true)}>
              <BanIcon className="mr-2 size-3.5" />
              Ignore this source for this card
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1 font-normal">
        {column.isTrusted && <Badge variant="info">Trusted</Badge>}
        <Badge variant={column.isChecked ? "success" : "warning"}>
          {column.isChecked ? "Checked" : "Unchecked"}
        </Badge>
      </div>

      <CompareConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        copy={{
          title: `Ignore ${column.label} for this card?`,
          description:
            "This column disappears from the card and stops counting toward review. You can bring it back from the ignored list.",
          confirmLabel: "Ignore source",
        }}
        onConfirm={onIgnore}
      />
    </th>
  );
}

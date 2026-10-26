import { EllipsisVerticalIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import { cn } from "@/lib/utils";

function DisabledAction({ reason, label }: { reason: string; label: string }) {
  return (
    <span title={reason}>
      <Button variant="outline" size="sm" disabled aria-label={`${label}. ${reason}`}>
        {label}
      </Button>
    </span>
  );
}

export function SuggestionChip({
  tone,
  sourceLabel,
  value,
  hotkey,
  onUse,
  onDiscard,
  discardLabel = "Discard",
  discardDisabledReason,
  onReject,
  onReply,
  replyDisabledReason,
  menu,
  bulk,
  pending = false,
}: {
  tone: "source" | "contributor";
  sourceLabel: string;
  value: ReactNode;
  hotkey?: number;
  onUse: () => void;
  onDiscard?: () => void;
  discardLabel?: string;
  discardDisabledReason?: string;
  onReject?: () => void;
  onReply?: () => void;
  replyDisabledReason?: string;
  menu?: ReactNode;
  bulk?: ReactNode;
  pending?: boolean;
}) {
  const isContributor = tone === "contributor";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        isContributor ? "bg-violet-soft" : "bg-warning-soft",
      )}
    >
      <Badge variant={isContributor ? "violet" : "info"}>{sourceLabel}</Badge>
      <span className="min-w-0 break-words">{value}</span>
      <span className="ml-auto flex flex-wrap items-center gap-1.5">
        {onReply === undefined ? (
          replyDisabledReason !== undefined && (
            <DisabledAction reason={replyDisabledReason} label="Reply" />
          )
        ) : (
          <Button variant="outline" size="sm" disabled={pending} onClick={onReply}>
            Reply
          </Button>
        )}
        {onReject !== undefined && (
          <Button variant="outline" size="sm" disabled={pending} onClick={onReject}>
            Reject
          </Button>
        )}
        {onDiscard === undefined ? (
          discardDisabledReason !== undefined && (
            <DisabledAction reason={discardDisabledReason} label={discardLabel} />
          )
        ) : (
          <Button variant="outline" size="sm" disabled={pending} onClick={onDiscard}>
            {discardLabel}
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={pending} onClick={onUse}>
          Use
          {hotkey !== undefined && <Kbd>{hotkey}</Kbd>}
        </Button>
        {menu !== undefined && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={pending}
                  aria-label={`More for this ${isContributor ? "proposal" : "suggestion"}`}
                />
              }
            >
              <EllipsisVerticalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">{menu}</DropdownMenuContent>
          </DropdownMenu>
        )}
      </span>
      {bulk}
    </div>
  );
}

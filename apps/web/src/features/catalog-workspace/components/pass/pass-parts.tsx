import { pluralize } from "@openrift/shared/strings";
import { EllipsisVerticalIcon } from "lucide-react";
import type { ReactNode } from "react";

import { PageTopBarBack } from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";

const LONG_VALUE = 48;

export function SourceUse({
  value,
  preview,
  source,
  label = "Use",
  pending,
  onUse,
}: {
  value?: string;
  preview?: ReactNode;
  source: string;
  label?: string;
  pending: boolean;
  onUse: () => void;
}) {
  const long = value !== undefined && value.length > LONG_VALUE;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        {preview}
        <Button
          variant="outline"
          size="sm"
          className="max-w-full min-w-0"
          title={value}
          disabled={pending}
          onClick={onUse}
        >
          <span className="truncate">
            {value === undefined || long ? label : `${label} ${value}`}
          </span>
        </Button>
        <span className="text-muted-foreground text-sm">{source}</span>
      </span>
      {long && <p className="text-muted-foreground text-sm break-words">{value}</p>}
    </div>
  );
}

export function ContributionActions({
  pending,
  onUse,
  onMarkApplied,
  onReject,
  onMove,
}: {
  pending: boolean;
  onUse?: () => void;
  onMarkApplied: () => void;
  onReject: () => void;
  onMove?: () => void;
}) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {onUse && (
        <Button variant="outline" size="sm" disabled={pending} onClick={onUse}>
          Use
        </Button>
      )}
      <Button variant="outline" size="sm" disabled={pending} onClick={onMarkApplied}>
        Mark as applied
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={onReject}>
        Reject and reply…
      </Button>
      {onMove && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                disabled={pending}
                aria-label="More contribution actions"
              />
            }
          >
            <EllipsisVerticalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={onMove}>Move to another card…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </span>
  );
}

export function ContributionBlock({
  name,
  note,
  value,
  otherChanges = 0,
  pending,
  onUse,
  onMarkApplied,
  onReject,
  onMove,
}: {
  name: string;
  note: string | null;
  value: ReactNode;
  otherChanges?: number;
  pending: boolean;
  onUse: () => void;
  onMarkApplied: () => void;
  onReject: () => void;
  onMove?: () => void;
}) {
  return (
    <div className="bg-violet-soft flex flex-col gap-1.5 rounded-md px-3 py-2">
      <p>
        <span className="font-medium">{name}</span>
        <span className="text-muted-foreground"> proposes</span>
      </p>
      <div className="min-w-0 break-words">{value}</div>
      {note !== null && note.trim() !== "" && (
        <p className="text-muted-foreground text-sm break-words">&ldquo;{note}&rdquo;</p>
      )}
      {otherChanges > 0 && (
        <p className="text-muted-foreground text-sm">
          Use closes the proposal. Its {otherChanges} other {pluralize(otherChanges, "change")}{" "}
          {pluralize(otherChanges, "stays", "stay")} unapplied.
        </p>
      )}
      <ContributionActions
        pending={pending}
        onUse={onUse}
        onMarkApplied={onMarkApplied}
        onReject={onReject}
        onMove={onMove}
      />
    </div>
  );
}

export function PassTopBar({
  position,
  inReview = true,
  actions,
}: {
  position: { index: number; total: number } | null;
  inReview?: boolean;
  actions?: ReactNode;
}) {
  const title =
    position === null
      ? inReview
        ? "Review"
        : "Cards"
      : `Review · ${position.index + 1} of ${position.total}`;
  return (
    <AdminPageTopBar
      back={
        inReview ? (
          <PageTopBarBack to="/admin/workspace/review" aria-label="Back to review" />
        ) : (
          <PageTopBarBack to="/admin/workspace/cards" aria-label="Back to cards" />
        )
      }
      title={title}
      actions={actions}
    />
  );
}

export function ContributorNote({ name, note }: { name: string; note: string | null }) {
  return (
    <div className="bg-violet-soft flex flex-col gap-1.5 rounded-md px-3 py-2">
      <p>
        <span className="font-medium">{name}</span>
        <span className="text-muted-foreground"> sent this card</span>
      </p>
      {note !== null && note.trim() !== "" && (
        <p className="text-muted-foreground text-sm break-words">&ldquo;{note}&rdquo;</p>
      )}
    </div>
  );
}

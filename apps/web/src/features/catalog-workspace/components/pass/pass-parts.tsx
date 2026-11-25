import { pluralize } from "@openrift/shared/strings";
import { useLocation } from "@tanstack/react-router";
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
import { valueParts } from "@/features/catalog-workspace/lib/value-diff";

export function SourceUse({
  value,
  current,
  preview,
  source,
  label = "Use",
  pending,
  onUse,
  onDismiss,
}: {
  value?: string;
  current?: string;
  preview?: ReactNode;
  source: string;
  label?: string;
  pending: boolean;
  onUse: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div className="bg-warning-soft col-span-full grid grid-cols-subgrid items-center gap-y-1 rounded-md py-1">
      <span className="text-muted-foreground text-sm break-words max-sm:col-span-full sm:pl-3">
        {source}
      </span>
      <div className="min-w-0 break-words">
        {preview ??
          (value === undefined
            ? null
            : valueParts(current, value).map((part, index) =>
                part.changed ? (
                  <ins
                    key={index}
                    className="decoration-warning font-medium underline decoration-2 underline-offset-2"
                  >
                    {part.text}
                  </ins>
                ) : (
                  <span key={index}>{part.text}</span>
                ),
              ))}
      </div>
      <span className="flex items-center justify-end gap-1.5 pr-1">
        <Button variant="outline" size="sm" disabled={pending} onClick={onUse}>
          {label}
        </Button>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            title={`Hide this value from ${source} until it reports another one`}
            onClick={onDismiss}
          >
            Dismiss
          </Button>
        )}
      </span>
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
    <div className="bg-violet-soft col-span-full flex flex-col gap-1.5 rounded-md px-3 py-2 sm:col-span-2 sm:col-start-2">
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
  const fromPrintingId = useLocation({
    select: (location) => location.state.workspaceFromPrintingId,
  });
  return (
    <AdminPageTopBar
      back={
        fromPrintingId === undefined ? (
          <PageTopBarBack to="/admin/workspace/cards" search aria-label="Back to cards" />
        ) : (
          <PageTopBarBack
            to="/admin/workspace/printings/$printingId"
            params={{ printingId: fromPrintingId }}
            aria-label="Back to the printing"
          />
        )
      }
      title={title}
      actions={actions}
    />
  );
}

export function ContributorNote({ name, note }: { name: string; note: string | null }) {
  return (
    <div className="bg-violet-soft col-span-full flex flex-col gap-1.5 rounded-md px-3 py-2 sm:col-span-2 sm:col-start-2">
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

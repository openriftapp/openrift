import { PencilIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DiffText } from "@/features/admin/components/candidate-cell-display";
import { PrintingIdLabel } from "@/features/admin/components/printing-id-label";
import { PrintingTargetMenu } from "@/features/admin/components/printing-target-menu";
import type { PrintingTarget } from "@/features/admin/components/printing-target-menu";
import type { AttentionChange, AttentionGroup } from "@/features/admin/lib/attention-items";
import { formatFieldValue } from "@/features/admin/lib/catalog-field-labels";
import { textDiff } from "@/lib/text-diff";
import { cn } from "@/lib/utils";

function isEditableChange(change: AttentionChange): boolean {
  if (change.kind === "image") {
    return false;
  }
  const value = change.proposed;
  return typeof value === "string" || typeof value === "number" || Array.isArray(value);
}

function scalarText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return value === null || value === undefined ? "" : JSON.stringify(value);
}

function toEditText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((entry) => scalarText(entry)).join(", ");
  }
  return scalarText(value);
}

function fromEditText(change: AttentionChange, text: string): unknown {
  if (Array.isArray(change.proposed)) {
    return text
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part !== "");
  }
  if (typeof change.proposed === "number") {
    const parsed = Number(text.trim());
    return Number.isFinite(parsed) ? parsed : change.proposed;
  }
  return text;
}

function Thumb({ url, label }: { url: string | null; label: string }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span className="bg-muted/30 flex h-24 w-16 items-center justify-center overflow-hidden rounded-md border">
        {url ? (
          <ImgWithFallback
            src={url}
            alt={label}
            className="size-full object-contain"
            fallback={<span className="text-muted-foreground text-2xs">Failed</span>}
          />
        ) : (
          <span className="text-muted-foreground text-2xs">None</span>
        )}
      </span>
      <span className="text-muted-foreground text-2xs">{label}</span>
    </span>
  );
}

interface ChangeRowProps {
  change: AttentionChange;
  isTicked: boolean;
  editedValue: unknown;
  isEditing: boolean;
  onToggle: () => void;
  onToggleEdit: () => void;
  onEdit: (value: unknown) => void;
}

function ChangeRow({
  change,
  isTicked,
  editedValue,
  isEditing,
  onToggle,
  onToggleEdit,
  onEdit,
}: ChangeRowProps) {
  const isEdited = editedValue !== undefined;
  const effective = isEdited ? editedValue : change.proposed;
  const checkboxId = `attention-${change.key}`;

  return (
    <li
      className={cn(
        "flex flex-col gap-1.5 rounded-md px-3 py-2",
        isEdited && "border-warning border-l-2",
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          id={checkboxId}
          checked={isTicked}
          className="mt-0.5 shrink-0"
          onCheckedChange={onToggle}
        />
        <label htmlFor={checkboxId} className="w-36 shrink-0 cursor-pointer text-sm">
          {change.label}
        </label>
        <div className="min-w-0 flex-1 text-sm">
          {change.kind === "image" ? (
            <span className="flex items-end gap-4">
              <Thumb url={typeof change.current === "string" ? change.current : null} label="Now" />
              <Thumb
                url={typeof change.proposed === "string" ? change.proposed : null}
                label="Proposed"
              />
            </span>
          ) : change.kind === "text" ? (
            <span className="whitespace-pre-wrap">
              <DiffText
                segments={textDiff(formatFieldValue(change.current), formatFieldValue(effective))}
              />
            </span>
          ) : (
            <span>
              <span className="text-muted-foreground line-through">
                {formatFieldValue(change.current)}
              </span>
              <span className="text-muted-foreground mx-2">&rarr;</span>
              <span>{formatFieldValue(effective)}</span>
            </span>
          )}
        </div>
        {isEditableChange(change) && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${change.label}`}
            className="shrink-0"
            onClick={onToggleEdit}
          >
            <PencilIcon />
          </Button>
        )}
      </div>

      {isEditing && (
        <div className="pl-8">
          {change.kind === "text" ? (
            <Textarea
              rows={4}
              value={toEditText(effective)}
              onChange={(event) => onEdit(fromEditText(change, event.target.value))}
            />
          ) : (
            <Input
              value={toEditText(effective)}
              onChange={(event) => onEdit(fromEditText(change, event.target.value))}
            />
          )}
        </div>
      )}

      {isEdited && (
        <p className="text-muted-foreground flex items-center gap-1.5 pl-8 text-xs">
          <TriangleAlertIcon className="text-warning size-3.5 shrink-0" />
          You are editing the incoming value.
        </p>
      )}
    </li>
  );
}

function NewPrintingLink({
  candidatePrintingId,
  onOpen,
}: {
  candidatePrintingId: string;
  onOpen: (candidatePrintingId: string) => void;
}) {
  return (
    <Button variant="link" className="shrink-0" onClick={() => onOpen(candidatePrintingId)}>
      Review it below instead
    </Button>
  );
}

interface AttentionChangeListProps {
  groups: readonly AttentionGroup[];
  ticked: ReadonlySet<string>;
  edits: ReadonlyMap<string, unknown>;
  onToggle: (key: string) => void;
  onEdit: (key: string, value: unknown) => void;
  printingTargets?: readonly PrintingTarget[];
  onLinkGroup?: (group: AttentionGroup, printingId: string) => void;
  onMoveGroup?: (group: AttentionGroup, printingId: string) => void;
  onOpenNewPrinting?: (candidatePrintingId: string) => void;
  blockedNewPrintings?: ReadonlyMap<string, string>;
}

export function AttentionChangeList({
  groups,
  ticked,
  edits,
  onToggle,
  onEdit,
  printingTargets = [],
  onLinkGroup,
  onMoveGroup,
  onOpenNewPrinting,
  blockedNewPrintings,
}: AttentionChangeListProps) {
  const [editing, setEditing] = useState<ReadonlySet<string>>(() => new Set());

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const blocker =
          group.candidate === null ? undefined : blockedNewPrintings?.get(group.candidate.id);
        return (
          <div key={group.key}>
            <div className="bg-muted flex items-center gap-2 rounded-md px-3 py-1">
              <span className="text-muted-foreground flex min-w-0 flex-1 items-center gap-1 text-xs font-medium">
                <span className="shrink-0">{group.title}</span>
                {group.printingLabel !== null && (
                  <span className="min-w-0 truncate">
                    (
                    <PrintingIdLabel label={group.printingLabel} language={group.language} />)
                  </span>
                )}
              </span>
              {onMoveGroup && group.kind === "printing" && (
                <PrintingTargetMenu
                  label="Move to another printing…"
                  className="shrink-0"
                  targets={printingTargets.filter((target) => target.id !== group.printingId)}
                  onPick={(printingId) => onMoveGroup(group, printingId)}
                />
              )}
            </div>
            <ul>
              {group.kind === "new-printing" ? (
                <li className="flex items-center gap-3 rounded-md px-3 py-2">
                  {blocker === undefined ? (
                    <>
                      <Checkbox
                        id={`attention-${group.key}`}
                        checked={ticked.has(group.key)}
                        className="shrink-0"
                        onCheckedChange={() => onToggle(group.key)}
                      />
                      <label
                        htmlFor={`attention-${group.key}`}
                        className="min-w-0 flex-1 cursor-pointer text-sm"
                      >
                        Ticked, accepting creates this printing exactly as it was sent.
                      </label>
                    </>
                  ) : (
                    <p className="text-muted-foreground flex min-w-0 flex-1 items-center gap-1.5 text-sm">
                      <TriangleAlertIcon className="text-warning size-4 shrink-0" />
                      Cannot be created as sent: {blocker}. Accepting leaves it alone.
                    </p>
                  )}
                  {onOpenNewPrinting && group.candidate && (
                    <NewPrintingLink
                      candidatePrintingId={group.candidate.id}
                      onOpen={onOpenNewPrinting}
                    />
                  )}
                  {onLinkGroup && (
                    <PrintingTargetMenu
                      label="Link to existing…"
                      className="shrink-0"
                      targets={printingTargets}
                      onPick={(printingId) => onLinkGroup(group, printingId)}
                    />
                  )}
                </li>
              ) : (
                group.changes.map((change) => (
                  <ChangeRow
                    key={change.key}
                    change={change}
                    isTicked={ticked.has(change.key)}
                    editedValue={edits.get(change.key)}
                    isEditing={editing.has(change.key)}
                    onToggle={() => onToggle(change.key)}
                    onToggleEdit={() =>
                      setEditing((prev) => {
                        const next = new Set(prev);
                        if (next.has(change.key)) {
                          next.delete(change.key);
                        } else {
                          next.add(change.key);
                        }
                        return next;
                      })
                    }
                    onEdit={(value) => onEdit(change.key, value)}
                  />
                ))
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

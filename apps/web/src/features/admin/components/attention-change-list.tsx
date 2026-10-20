import { PencilIcon, TriangleAlertIcon } from "lucide-react";
import { Fragment, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Textarea } from "@/components/ui/textarea";
import { DiffText, ImageZoom } from "@/features/admin/components/candidate-cell-display";
import { PrintingIdLabel } from "@/features/admin/components/printing-id-label";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { PrintingTargetMenu } from "@/features/admin/components/printing-target-menu";
import type { PrintingTarget } from "@/features/admin/components/printing-target-menu";
import type {
  AttentionChange,
  AttentionGroup,
  ClosestPrinting,
} from "@/features/admin/lib/attention-items";
import { formatFieldValue } from "@/features/admin/lib/catalog-field-labels";
import { CardText } from "@/features/cards/components/card-text";
import { textDiff } from "@/lib/text-diff";
import { cn } from "@/lib/utils";

const EMPTY_TICKED: ReadonlySet<string> = new Set();
const EMPTY_EDITS: ReadonlyMap<string, unknown> = new Map();

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

function Thumb({
  url,
  label,
  landscape,
}: {
  url: string | null;
  label: string;
  landscape: boolean;
}) {
  return (
    <span className="flex flex-col items-center gap-1">
      <PrintingImageBox
        url={url}
        alt={label}
        landscape={landscape}
        className={landscape ? "w-24" : "w-16"}
      />
      <span className="text-muted-foreground text-2xs">{label}</span>
    </span>
  );
}

function FormattedText({ field, value }: { field: string; value: unknown }) {
  if (typeof value !== "string" || value === "") {
    return formatFieldValue(value);
  }
  if (field === "flavorText") {
    return <span className="whitespace-pre-line italic">{value}</span>;
  }
  return <CardText text={value} interactive={false} />;
}

function TextComparison({
  field,
  current,
  proposed,
  imageUrl,
  landscape,
}: {
  field: string;
  current: unknown;
  proposed: unknown;
  imageUrl: string | null;
  landscape: boolean;
}) {
  const segments =
    typeof current === "string" && typeof proposed === "string" && current !== ""
      ? textDiff(current, proposed)
      : null;
  return (
    <span className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      {(["current", "proposed"] as const).map((side) => (
        <span key={side} className="flex min-w-0 flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            {side === "current" ? "Now" : "Incoming"}
          </span>
          <span>
            <FormattedText field={field} value={side === "current" ? current : proposed} />
          </span>
          {segments !== null && (
            <span className="text-muted-foreground text-xs whitespace-pre-line">
              <DiffText segments={segments} side={side} />
            </span>
          )}
        </span>
      ))}
      {imageUrl !== null && (
        <ImageZoom
          url={imageUrl}
          alt="Printed card"
          className={cn("self-start", landscape ? "w-32" : "w-24")}
        >
          <PrintingImageBox url={imageUrl} alt="Printed card" landscape={landscape} />
        </ImageZoom>
      )}
    </span>
  );
}

interface ChangeRowProps {
  change: AttentionChange;
  imageUrl: string | null;
  landscape: boolean;
  isTicked: boolean;
  editedValue: unknown;
  isEditing: boolean;
  readOnly: boolean;
  selectable: boolean;
  onToggle: () => void;
  onToggleEdit: () => void;
  onEdit: (value: unknown) => void;
}

function ChangeRow({
  change,
  imageUrl,
  landscape,
  isTicked,
  editedValue,
  isEditing,
  readOnly,
  selectable,
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
        {readOnly || !selectable ? (
          <span className="w-36 shrink-0 text-sm">{change.label}</span>
        ) : (
          <>
            <Checkbox
              id={checkboxId}
              checked={isTicked}
              className="mt-0.5 shrink-0"
              onCheckedChange={onToggle}
            />
            <label htmlFor={checkboxId} className="w-36 shrink-0 cursor-pointer text-sm">
              {change.label}
            </label>
          </>
        )}
        <div className="min-w-0 flex-1 text-sm">
          {change.kind === "image" ? (
            <span className="flex items-end gap-4">
              <Thumb
                url={typeof change.current === "string" ? change.current : null}
                label="Now"
                landscape={landscape}
              />
              <Thumb
                url={typeof change.proposed === "string" ? change.proposed : null}
                label="Proposed"
                landscape={landscape}
              />
            </span>
          ) : change.kind === "text" ? (
            <TextComparison
              field={change.field}
              current={change.current}
              proposed={effective}
              imageUrl={imageUrl}
              landscape={landscape}
            />
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
        {!readOnly && isEditableChange(change) && (
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

function ClosestPrintingTable({ closest }: { closest: ClosestPrinting }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
      <span />
      <span className="text-muted-foreground text-xs">Incoming</span>
      <span className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
        <span className="shrink-0">Closest existing</span>
        <PrintingIdLabel
          label={closest.printing.expectedPrintingId}
          language={closest.printing.language}
        />
      </span>
      {closest.rows.map((row) => (
        <Fragment key={row.field}>
          <span className="text-muted-foreground">{row.label}</span>
          <span className={cn("line-clamp-3 min-w-0", row.differs && "text-warning font-medium")}>
            {formatFieldValue(row.incoming)}
          </span>
          <span className="text-muted-foreground line-clamp-3 min-w-0">
            {formatFieldValue(row.existing)}
          </span>
        </Fragment>
      ))}
    </div>
  );
}

function closestHint(closest: ClosestPrinting): string {
  const labels = closest.differingLabels;
  if (labels.length === 0) {
    return "Matches this existing printing in every field that was sent.";
  }
  const list =
    labels.length === 1
      ? (labels[0] ?? "")
      : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
  return `Differs only in ${list.toLowerCase()}. This may be the existing printing.`;
}

const CLOSE_MATCH_MAX_DIFFERENCES = 2;

function NewPrintingRow({
  group,
  landscape,
  isTicked,
  selectable,
  blocker,
  isRepeat,
  onToggle,
}: {
  group: AttentionGroup;
  landscape: boolean;
  isTicked: boolean;
  selectable: boolean;
  blocker: string | undefined;
  isRepeat: boolean;
  onToggle: () => void;
}) {
  const closest = group.closest;
  const checkboxId = `attention-${group.key}`;
  return (
    <li className="flex flex-col gap-3 rounded-md px-3 py-2">
      {blocker === undefined ? (
        selectable && (
          <div className="flex items-center gap-3">
            <Checkbox
              id={checkboxId}
              checked={isTicked}
              className="shrink-0"
              onCheckedChange={onToggle}
            />
            <label htmlFor={checkboxId} className="cursor-pointer text-sm">
              Create this printing
            </label>
          </div>
        )
      ) : (
        <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <TriangleAlertIcon className="text-warning size-4 shrink-0" />
          Cannot be created as sent: {blocker}. Accepting leaves it alone.
        </p>
      )}
      <div className="flex items-start gap-4">
        {group.imageUrl === null ? (
          <PrintingImageBox
            url={null}
            alt="No image sent"
            landscape={landscape}
            className={cn("shrink-0", landscape ? "w-32" : "w-24")}
          />
        ) : (
          <ImageZoom
            url={group.imageUrl}
            alt="Incoming image"
            className={cn("shrink-0", landscape ? "w-32" : "w-24")}
          >
            <PrintingImageBox url={group.imageUrl} alt="Incoming image" landscape={landscape} />
          </ImageZoom>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {closest === null ? (
            <p className="text-sm">{group.summary}</p>
          ) : (
            <ClosestPrintingTable closest={closest} />
          )}
          {closest !== null && closest.differingLabels.length <= CLOSE_MATCH_MAX_DIFFERENCES && (
            <p className="text-warning flex items-center gap-1.5 text-sm">
              <TriangleAlertIcon className="size-4 shrink-0" />
              {closestHint(closest)}
            </p>
          )}
          {isRepeat && (
            <p className="text-muted-foreground text-sm">Same printing as a submission above.</p>
          )}
        </div>
      </div>
    </li>
  );
}

interface AttentionChangeListProps {
  groups: readonly AttentionGroup[];
  ticked?: ReadonlySet<string>;
  edits?: ReadonlyMap<string, unknown>;
  readOnly?: boolean;
  selectable?: boolean;
  landscape?: boolean;
  onToggle?: (key: string) => void;
  onEdit?: (key: string, value: unknown) => void;
  printingTargets?: readonly PrintingTarget[];
  onLinkGroup?: (group: AttentionGroup, printingId: string) => void;
  onMoveGroup?: (group: AttentionGroup, printingId: string) => void;
  onOpenNewPrinting?: (candidatePrintingId: string) => void;
  onOpenPrinting?: (printingId: string) => void;
  blockedNewPrintings?: ReadonlyMap<string, string>;
  repeatedNewPrintings?: ReadonlySet<string>;
}

export function AttentionChangeList({
  groups,
  ticked = EMPTY_TICKED,
  edits = EMPTY_EDITS,
  readOnly = false,
  selectable = true,
  landscape = false,
  onToggle,
  onEdit,
  printingTargets = [],
  onLinkGroup,
  onMoveGroup,
  onOpenNewPrinting,
  onOpenPrinting,
  blockedNewPrintings,
  repeatedNewPrintings,
}: AttentionChangeListProps) {
  const [editing, setEditing] = useState<ReadonlySet<string>>(() => new Set());

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const blocker =
          group.candidate === null ? undefined : blockedNewPrintings?.get(group.candidate.id);
        return (
          <div key={group.key} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-3">
              <SectionHeading as="h3" size="sm" className="flex min-w-0 flex-1 items-center gap-1">
                <span className="shrink-0">{group.title}</span>
                {group.printingLabel !== null &&
                  (onOpenPrinting && group.printingId !== null ? (
                    <Button
                      variant="link"
                      className="h-auto min-w-0 truncate p-0"
                      onClick={() => {
                        if (group.printingId !== null) {
                          onOpenPrinting(group.printingId);
                        }
                      }}
                    >
                      <PrintingIdLabel label={group.printingLabel} language={group.language} />
                    </Button>
                  ) : (
                    <span className="min-w-0 truncate">
                      (
                      <PrintingIdLabel label={group.printingLabel} language={group.language} />)
                    </span>
                  ))}
              </SectionHeading>
              {group.kind === "new-printing" && onOpenNewPrinting && group.candidate && (
                <Button
                  variant="link"
                  className="shrink-0"
                  onClick={() => {
                    if (group.candidate !== null) {
                      onOpenNewPrinting(group.candidate.id);
                    }
                  }}
                >
                  Show the face row
                </Button>
              )}
              {group.kind === "new-printing" && onLinkGroup && (
                <PrintingTargetMenu
                  label="Link to existing…"
                  className="shrink-0"
                  targets={printingTargets}
                  onPick={(printingId) => onLinkGroup(group, printingId)}
                />
              )}
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
                <NewPrintingRow
                  group={group}
                  landscape={landscape}
                  isTicked={ticked.has(group.key)}
                  selectable={selectable}
                  blocker={blocker}
                  isRepeat={repeatedNewPrintings?.has(group.key) ?? false}
                  onToggle={() => onToggle?.(group.key)}
                />
              ) : (
                group.changes.map((change) => (
                  <ChangeRow
                    key={change.key}
                    change={change}
                    imageUrl={group.imageUrl}
                    landscape={landscape}
                    isTicked={ticked.has(change.key)}
                    editedValue={edits.get(change.key)}
                    isEditing={editing.has(change.key)}
                    readOnly={readOnly}
                    selectable={selectable}
                    onToggle={() => onToggle?.(change.key)}
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
                    onEdit={(value) => onEdit?.(change.key, value)}
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

import { PencilIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CardList } from "@/components/ui/card-list";
import { Checkbox } from "@/components/ui/checkbox";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DiffText } from "@/features/admin/components/candidate-cell-display";
import type { AttentionChange, AttentionGroup } from "@/features/catalog-admin/lib/attention-items";
import { formatFieldValue } from "@/features/catalog-admin/lib/catalog-field-labels";
import { textDiff } from "@/lib/text-diff";
import { cn } from "@/lib/utils";

export function isEditableChange(change: AttentionChange): boolean {
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

export function toEditText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((entry) => scalarText(entry)).join(", ");
  }
  return scalarText(value);
}

export function fromEditText(change: AttentionChange, text: string): unknown {
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
    <li className={cn("flex flex-col gap-1.5 rounded-md px-3 py-2", isEdited && "bg-warning-soft")}>
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

      {isEdited && <p className="text-warning pl-8 text-xs">You are editing the incoming value.</p>}
    </li>
  );
}

interface AttentionChangeListProps {
  groups: readonly AttentionGroup[];
  ticked: ReadonlySet<string>;
  edits: ReadonlyMap<string, unknown>;
  onToggle: (key: string) => void;
  onEdit: (key: string, value: unknown) => void;
}

export function AttentionChangeList({
  groups,
  ticked,
  edits,
  onToggle,
  onEdit,
}: AttentionChangeListProps) {
  const [editing, setEditing] = useState<ReadonlySet<string>>(() => new Set());
  const [showUnchanged, setShowUnchanged] = useState(false);

  const unchanged = groups.flatMap((group) => group.unchangedFields);

  return (
    <div className="space-y-2">
      <CardList>
        {groups.map((group) => (
          <li key={group.key}>
            <p className="text-muted-foreground bg-muted rounded-md px-3 py-1.5 text-xs font-medium">
              {group.title}
            </p>
            <ul>
              {group.kind === "new-printing" ? (
                <li className="flex items-center gap-3 rounded-md px-3 py-2">
                  <Checkbox
                    id={`attention-${group.key}`}
                    checked={ticked.has(group.key)}
                    className="shrink-0"
                    onCheckedChange={() => onToggle(group.key)}
                  />
                  <label
                    htmlFor={`attention-${group.key}`}
                    className="min-w-0 flex-1 cursor-pointer truncate text-sm"
                  >
                    {group.summary}
                  </label>
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
          </li>
        ))}
      </CardList>

      {unchanged.length > 0 && (
        <div className="text-muted-foreground text-xs">
          <Button variant="ghost" onClick={() => setShowUnchanged(!showUnchanged)}>
            {unchanged.length} field{unchanged.length === 1 ? "" : "s"} unchanged ·{" "}
            {showUnchanged ? "hide" : "show"}
          </Button>
          {showUnchanged && <p className="px-3 pt-1">{unchanged.join(", ")}</p>}
        </div>
      )}
    </div>
  );
}

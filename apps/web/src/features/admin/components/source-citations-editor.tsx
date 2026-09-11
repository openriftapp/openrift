import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CitationEntry } from "@/features/cards/components/card-detail/printing-citations";

export interface EditableCitation {
  id: string;
  label: string;
  sourceUrl: string | null;
}

interface SourceCitationsEditorProps<T extends EditableCitation> {
  citations: readonly T[];
  isPending: boolean;
  description?: ReactNode;
  emptyText?: string;
  labelPlaceholder: string;
  creating: boolean;
  deleting: boolean;
  onAdd: (input: { label: string; sourceUrl: string | null }) => Promise<unknown>;
  onUpdate?: (
    citationId: string,
    input: { label: string; sourceUrl: string | null },
  ) => Promise<unknown>;
  onDelete: (citationId: string) => void;
  renderBadge?: (citation: T) => ReactNode;
  /** When this returns a string, the row cannot be deleted here and says so instead. */
  lockedReason?: (citation: T) => string | null;
  adding?: boolean;
  onAddingChange?: (adding: boolean) => void;
  hideWhenIdle?: boolean;
}

function CitationRow<T extends EditableCitation>({
  citation,
  labelPlaceholder,
  deleting,
  saving,
  onUpdate,
  onDelete,
  renderBadge,
  lockedReason,
}: {
  citation: T;
  labelPlaceholder: string;
  deleting: boolean;
  saving: boolean;
  onUpdate?: (
    citationId: string,
    input: { label: string; sourceUrl: string | null },
  ) => Promise<unknown>;
  onDelete: (citationId: string) => void;
  renderBadge?: (citation: T) => ReactNode;
  lockedReason?: (citation: T) => string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(citation.label);
  const [url, setUrl] = useState(citation.sourceUrl ?? "");
  const locked = lockedReason?.(citation) ?? null;

  async function handleSave() {
    if (!onUpdate) {
      return;
    }
    // Resolved before the try: the React Compiler cannot lower a conditional
    // that sits inside one.
    const trimmedUrl = url.trim();
    const sourceUrl = trimmedUrl.length > 0 ? trimmedUrl : null;
    try {
      await onUpdate(citation.id, { label: label.trim(), sourceUrl });
    } catch {
      // Reported by the global mutation error toast.
      return;
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="flex flex-wrap items-center gap-2 border-b py-1.5 last:border-b-0">
        <Input
          aria-label="Source name"
          className="min-w-40 flex-1"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={labelPlaceholder}
        />
        <Input
          aria-label="Source link"
          className="min-w-40 flex-2"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… (optional)"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={label.trim().length === 0 || saving}
          onClick={() => void handleSave()}
        >
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEditing(false);
            setLabel(citation.label);
            setUrl(citation.sourceUrl ?? "");
          }}
        >
          Cancel
        </Button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 border-b py-1.5 last:border-b-0">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <CitationEntry citation={citation} />
        {renderBadge?.(citation)}
      </div>
      {locked === null ? (
        <>
          {onUpdate && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit source link ${citation.label}`}
              onClick={() => setEditing(true)}
            >
              <PencilIcon className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete source link ${citation.label}`}
            disabled={deleting}
            onClick={() => onDelete(citation.id)}
          >
            <Trash2Icon className="size-4" />
          </Button>
        </>
      ) : (
        <span className="text-muted-foreground shrink-0 text-sm">{locked}</span>
      )}
    </li>
  );
}

/**
 * Shared by the meta archive's event editor and the catalog's promo printings;
 * per-surface differences arrive via the `renderBadge` / `lockedReason` callbacks.
 */
export function SourceCitationsEditor<T extends EditableCitation>({
  citations,
  isPending,
  description,
  emptyText,
  labelPlaceholder,
  creating,
  deleting,
  onAdd,
  onUpdate,
  onDelete,
  renderBadge,
  lockedReason,
  adding: addingProp,
  onAddingChange,
  hideWhenIdle,
}: SourceCitationsEditorProps<T>) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [selfAdding, setSelfAdding] = useState(false);
  const controlled = addingProp !== undefined;
  const adding = controlled ? addingProp : selfAdding;
  const setAdding = controlled ? (onAddingChange ?? setSelfAdding) : setSelfAdding;

  const trimmedLabel = label.trim();

  async function handleAdd() {
    // Resolved before the try: the React Compiler cannot lower a conditional
    // that sits inside one.
    const trimmedUrl = url.trim();
    const sourceUrl = trimmedUrl.length > 0 ? trimmedUrl : null;
    try {
      await onAdd({ label: trimmedLabel, sourceUrl });
    } catch {
      // Reported by the global mutation error toast.
      return;
    }
    setLabel("");
    setUrl("");
    setAdding(false);
  }

  if (hideWhenIdle === true && citations.length === 0 && !adding && !isPending) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div>
        <Label>Source links</Label>
        {description !== undefined && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>

      {isPending && <p className="text-muted-foreground text-sm">Loading citations…</p>}
      {!isPending && citations.length === 0 && emptyText !== undefined && (
        <p className="text-muted-foreground text-sm">{emptyText}</p>
      )}
      {citations.length > 0 && (
        <ul className="rounded-md border px-3">
          {citations.map((citation) => (
            <CitationRow
              key={citation.id}
              citation={citation}
              labelPlaceholder={labelPlaceholder}
              deleting={deleting}
              saving={creating}
              onUpdate={onUpdate}
              onDelete={onDelete}
              renderBadge={renderBadge}
              lockedReason={lockedReason}
            />
          ))}
        </ul>
      )}

      {adding ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Source name"
            className="min-w-40 flex-1"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={labelPlaceholder}
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- admin-only UI, the button that reveals this field is the intent to type
            autoFocus
          />
          <Input
            aria-label="Source link"
            className="min-w-40 flex-2"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://… (optional)"
          />
          <Button
            variant="outline"
            disabled={trimmedLabel.length === 0 || creating}
            onClick={() => void handleAdd()}
          >
            <PlusIcon />
            Add source link
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setAdding(false);
              setLabel("");
              setUrl("");
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        !controlled && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <PlusIcon />
            Add source link
          </Button>
        )
      )}
    </div>
  );
}

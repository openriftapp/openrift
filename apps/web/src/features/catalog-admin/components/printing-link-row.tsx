import type { AdminPrintingCitation } from "@openrift/shared/types/api/admin";
import { CheckIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PrintingLinkRow({
  citation,
  isBusy,
  onSave,
  onDelete,
}: {
  citation: AdminPrintingCitation;
  isBusy: boolean;
  onSave: (next: { label: string; sourceUrl: string | null }) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<{ label: string; sourceUrl: string } | null>(null);

  async function commit(next: { label: string; sourceUrl: string }) {
    const saved = await onSave({
      label: next.label.trim(),
      sourceUrl: next.sourceUrl.trim() || null,
    });
    if (saved) {
      setDraft(null);
    }
  }

  if (draft !== null) {
    return (
      <li className="flex flex-wrap items-center gap-2 px-2 py-1.5">
        <Input
          aria-label="Link label"
          value={draft.label}
          className="min-w-40 flex-1"
          onChange={(event) => setDraft({ ...draft, label: event.target.value })}
        />
        <Input
          aria-label="Link address"
          value={draft.sourceUrl}
          placeholder="https://…"
          className="min-w-40 flex-1"
          onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })}
        />
        <Button
          size="sm"
          disabled={isBusy || draft.label.trim().length === 0}
          onClick={() => void commit(draft)}
        >
          <CheckIcon />
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
          <XIcon />
          Cancel
        </Button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 px-2 py-1.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{citation.label}</span>
        {citation.sourceUrl !== null && (
          <a
            href={citation.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground block truncate text-sm underline underline-offset-2"
          >
            {citation.sourceUrl}
          </a>
        )}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Edit link ${citation.label}`}
        disabled={!citation.canEdit}
        onClick={() => setDraft({ label: citation.label, sourceUrl: citation.sourceUrl ?? "" })}
      >
        <PencilIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive"
        aria-label={`Delete link ${citation.label}`}
        disabled={isBusy || !citation.canEdit}
        onClick={onDelete}
      >
        <Trash2Icon />
      </Button>
    </li>
  );
}

import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateDeckVariant } from "@/features/decks/hooks/use-decks";
import { m } from "@/paraglide/messages.js";

interface DeckVariantCreateDialogProps {
  deckId: string;
  deckName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function defaultVariantName(deckName: string): string {
  return m.decks_dialog_variant_default_name({ name: deckName });
}

export function DeckVariantCreateForm({
  deckId,
  deckName,
  layout,
  open = true,
  sources,
  onCancel,
  onCreated,
}: {
  deckId: string;
  deckName: string;
  layout: "dialog" | "inline";
  open?: boolean;
  sources?: { value: string; label: string }[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [sourceId, setSourceId] = useState(deckId);
  const [draft, setDraft] = useState(() => defaultVariantName(deckName));
  const createVariant = useCreateDeckVariant();
  const navigate = useNavigate();
  const inputId = `deck-variant-name-${layout}`;
  const showSources = sources !== undefined && sources.length > 1;
  const sourceName = sources?.find((item) => item.value === sourceId)?.label ?? deckName;

  // Fields re-seed on every open, not just at mount: one form instance outlives any single use.
  const [seed, setSeed] = useState({ open, deckId, deckName });
  if (seed.open !== open || seed.deckId !== deckId || seed.deckName !== deckName) {
    setSeed({ open, deckId, deckName });
    if (open) {
      setSourceId(deckId);
      setDraft(defaultVariantName(deckName));
    }
  }

  const handleSourceChange = (value: string | null) => {
    const nextId = value ?? deckId;
    const next = sources?.find((item) => item.value === nextId);
    setSourceId(nextId);
    if (next && draft === defaultVariantName(sourceName)) {
      setDraft(defaultVariantName(next.label));
    }
  };

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || createVariant.isPending) {
      return;
    }
    createVariant.mutate(
      { deckId: sourceId, name: trimmed },
      {
        onSuccess: (created) => {
          onCreated();
          void navigate({ to: "/decks/$deckId", params: { deckId: created.id } });
        },
        // Errors are reported by the global mutation error toast.
      },
    );
  };

  const fields = (
    <div className="flex min-w-0 flex-col gap-3">
      {showSources && (
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={`deck-variant-source-${layout}`}>
            {m.decks_dialog_variant_source_label()}
          </Label>
          <Select items={sources} value={sourceId} onValueChange={handleSourceChange}>
            <SelectTrigger id={`deck-variant-source-${layout}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sources.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor={inputId}>{m.common_name()}</Label>
        <Input
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={200}
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- intentional: the form only appears on demand, so it should grab focus
          autoFocus
        />
      </div>
    </div>
  );
  const actions = (
    <>
      <Button variant="outline" onClick={onCancel}>
        {m.common_cancel()}
      </Button>
      <Button type="submit" disabled={draft.trim().length === 0 || createVariant.isPending}>
        {m.decks_dialog_variant_create_submit()}
      </Button>
    </>
  );

  if (layout === "dialog") {
    return (
      <DialogForm onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>{m.decks_dialog_variant_create_title()}</DialogTitle>
          <DialogDescription>{m.decks_dialog_variant_create_description()}</DialogDescription>
        </DialogHeader>
        {fields}
        <DialogFooter>{actions}</DialogFooter>
      </DialogForm>
    );
  }

  return (
    <form
      className="bg-muted flex min-w-0 flex-col gap-3 rounded-md p-3"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">{m.decks_dialog_variant_create_title()}</span>
        <span className="text-muted-foreground text-sm">
          {m.decks_dialog_variant_create_description()}
        </span>
      </div>
      {fields}
      <div className="flex justify-end gap-2">{actions}</div>
    </form>
  );
}

// For surfaces with no open panel to expand into (the rail's "+" button, the deck editor's menu).
export function DeckVariantCreateDialog({
  deckId,
  deckName,
  open,
  onOpenChange,
}: DeckVariantCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DeckVariantCreateForm
          deckId={deckId}
          deckName={deckName}
          layout="dialog"
          open={open}
          onCancel={() => onOpenChange(false)}
          onCreated={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

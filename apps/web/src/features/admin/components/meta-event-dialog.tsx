import type { AdminMetaEvent } from "@openrift/shared/types/api/meta";
import { META_EVENT_TIERS } from "@openrift/shared/types/enums";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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
import { SimpleSelect } from "@/components/ui/simple-select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateMetaEvent, useUpdateMetaEvent } from "@/features/admin/hooks/use-admin-meta";
import { useWriteMetaEventOverlayFields } from "@/features/admin/hooks/use-admin-meta-overlays";
import type { MetaEventBody, MetaEventDraft } from "@/features/admin/lib/admin-meta-draft";
import {
  EMPTY_META_EVENT_DRAFT,
  metaEventDraftToBody,
  metaEventOverlayEdits,
  metaEventToDraft,
  validateMetaEventDraft,
} from "@/features/admin/lib/admin-meta-draft";
import { metaEventTierLabels } from "@/features/meta/lib/meta-format";
import { useDeckFormatList } from "@/hooks/use-enums";
import { errorText } from "@/lib/error-text";
import { runReportedMutation } from "@/lib/run-reported-mutation";

const FORM_ID = "meta-event-form";

interface MetaEventDialogProps {
  event?: AdminMetaEvent;
  onClose: () => void;
}

// Editing writes the slug first: a failed rename should not leave an overlay claim behind.
export function MetaEventDialog({ event, onClose }: MetaEventDialogProps) {
  const { formats } = useDeckFormatList();
  const createEvent = useCreateMetaEvent();
  const updateEvent = useUpdateMetaEvent();
  const writeOverlay = useWriteMetaEventOverlayFields({ inlineError: true });

  const [draft, setDraft] = useState<MetaEventDraft>(() =>
    event ? metaEventToDraft(event) : { ...EMPTY_META_EVENT_DRAFT, format: formats[0]?.slug ?? "" },
  );
  const [formError, setFormError] = useState("");

  const isPending = createEvent.isPending || updateEvent.isPending || writeOverlay.isPending;

  function set<TKey extends keyof MetaEventDraft>(key: TKey, value: MetaEventDraft[TKey]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function saveEdit(current: AdminMetaEvent, body: MetaEventBody): Promise<void> {
    if (body.slug !== current.slug) {
      await updateEvent.mutateAsync({ id: current.id, slug: body.slug });
    }
    const edits = metaEventOverlayEdits(current, body);
    if (edits.length > 0) {
      await writeOverlay.mutateAsync({ id: current.id, edits });
    }
  }

  async function handleSubmit() {
    const problem = validateMetaEventDraft(draft);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError("");
    const body = metaEventDraftToBody(draft);
    const save = event ? () => saveEdit(event, body) : () => createEvent.mutateAsync(body);
    const successMessage = event ? `Updated "${body.name}"` : `Created "${body.name}"`;
    const saved = await runReportedMutation(save, (error) =>
      setFormError(errorText(error, "Save failed")),
    );
    if (saved) {
      toast.success(successMessage);
      onClose();
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogForm id={FORM_ID} onSubmit={() => void handleSubmit()}>
          <DialogHeader>
            <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
            <DialogDescription>
              The slug is the event&apos;s public URL. Renaming it breaks existing links.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="meta-event-slug">Slug</Label>
              <Input
                id="meta-event-slug"
                value={draft.slug}
                onChange={(e) => set("slug", e.target.value.toLowerCase())}
                placeholder="summoner-skirmish-2026"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meta-event-name">Name</Label>
              <Input
                id="meta-event-name"
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Summoner Skirmish 2026"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Date</Label>
              <DatePicker
                value={draft.eventDate}
                onValueChange={(iso) => set("eventDate", iso)}
                onClear={() => set("eventDate", "")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meta-event-format">Format</Label>
              <SimpleSelect
                id="meta-event-format"
                items={formats.map((format) => ({ value: format.slug, label: format.label }))}
                value={draft.format}
                onChange={(value) => set("format", value)}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meta-event-tier">Tier</Label>
              <SimpleSelect
                id="meta-event-tier"
                items={META_EVENT_TIERS.map((tier) => ({
                  value: tier,
                  label: metaEventTierLabels()[tier],
                }))}
                value={draft.tier}
                onChange={(value) => set("tier", value)}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meta-event-players">Players</Label>
              <Input
                id="meta-event-players"
                value={draft.playerCount}
                inputMode="numeric"
                onChange={(e) => set("playerCount", e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meta-event-organizer">Organizer</Label>
              <Input
                id="meta-event-organizer"
                value={draft.organizer}
                onChange={(e) => set("organizer", e.target.value)}
                placeholder="Optional, e.g. LGS Berlin"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meta-event-country">Country</Label>
              <Input
                id="meta-event-country"
                value={draft.country}
                onChange={(e) => set("country", e.target.value.toUpperCase())}
                placeholder="Optional, e.g. DE"
                maxLength={2}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meta-event-location">Address</Label>
              <Input
                id="meta-event-location"
                value={draft.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Optional venue address"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="meta-event-notes">Notes</Label>
              <Textarea
                id="meta-event-notes"
                value={draft.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Optional markdown, shown on the event page"
                className="min-h-24"
              />
            </div>
          </div>

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
        </DialogForm>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={isPending}>
            {event ? "Save" : "Create event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import type { MetaEventDetail } from "@openrift/shared/types/api/meta";
import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitMetaEventCorrection } from "@/features/meta/hooks/use-meta-submissions";
import type { MetaEventCorrectionDraft } from "@/features/meta/lib/meta-event-correction-form";
import {
  metaEventCorrectionDraft,
  metaEventCorrectionEdits,
  validateMetaEventCorrectionDraft,
} from "@/features/meta/lib/meta-event-correction-form";
import { useDeckFormatList } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

/** Submits to the review queue; nothing here edits the event, an admin applies it by hand. */
export function MetaEventCorrectionDialog({
  event,
  onClose,
}: {
  event: MetaEventDetail;
  onClose: () => void;
}) {
  const { labels: formatLabels } = useDeckFormatList();
  const submit = useSubmitMetaEventCorrection();
  const [draft, setDraft] = useState<MetaEventCorrectionDraft>(() =>
    metaEventCorrectionDraft(event),
  );
  const [problem, setProblem] = useState("");
  const [sent, setSent] = useState(false);

  function set<TKey extends keyof MetaEventCorrectionDraft>(
    key: TKey,
    value: MetaEventCorrectionDraft[TKey],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    const found = validateMetaEventCorrectionDraft(draft, event);
    if (found !== null) {
      setProblem(found);
      return;
    }
    setProblem("");
    let outcome;
    try {
      outcome = await submit.mutateAsync({
        metaEventId: event.id,
        fieldEdits: metaEventCorrectionEdits(draft, event),
        note: draft.note.trim(),
      });
    } catch {
      /* Reported by the global mutation error toast. */
      return;
    }
    if (!outcome.ok) {
      setProblem(outcome.message);
      return;
    }
    setSent(true);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogForm onSubmit={() => void handleSubmit()}>
          <DialogHeader>
            <DialogTitle>{m.meta_correction_title()}</DialogTitle>
            <DialogDescription>
              {sent ? m.meta_correction_sent() : m.meta_correction_description()}
            </DialogDescription>
          </DialogHeader>

          {!sent && (
            <div className="max-h-[60vh] overflow-y-auto py-2">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="meta-correction-note">
                    {m.meta_correction_whats_wrong()}
                  </FieldLabel>
                  <Textarea
                    id="meta-correction-note"
                    value={draft.note}
                    rows={3}
                    maxLength={2000}
                    placeholder={m.meta_correction_note_placeholder()}
                    onChange={(e) => set("note", e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="meta-correction-name">
                    {m.meta_correction_event_name()}
                  </FieldLabel>
                  <Input
                    id="meta-correction-name"
                    value={draft.name}
                    maxLength={120}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="meta-correction-date">
                    {m.meta_correction_event_date()}
                  </FieldLabel>
                  <DatePicker
                    value={draft.eventDate}
                    onChange={(iso) => set("eventDate", iso)}
                    onClear={() => set("eventDate", event.eventDate)}
                    className="w-full"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="meta-correction-players">
                    {m.meta_correction_players()}
                  </FieldLabel>
                  <Input
                    id="meta-correction-players"
                    inputMode="numeric"
                    value={draft.playerCount}
                    placeholder="64"
                    onChange={(e) => set("playerCount", e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="meta-correction-organizer">
                    {m.meta_correction_organizer()}
                  </FieldLabel>
                  <Input
                    id="meta-correction-organizer"
                    value={draft.organizer}
                    maxLength={120}
                    placeholder="Rift Games Berlin"
                    onChange={(e) => set("organizer", e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="meta-correction-location">
                    {m.meta_correction_venue()}
                  </FieldLabel>
                  <Input
                    id="meta-correction-location"
                    value={draft.location}
                    maxLength={200}
                    placeholder="Ionia Hall, Berlin"
                    onChange={(e) => set("location", e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="meta-correction-country">
                    {m.meta_correction_country()}
                  </FieldLabel>
                  <Input
                    id="meta-correction-country"
                    value={draft.country}
                    maxLength={2}
                    placeholder="DE"
                    className="w-20 uppercase"
                    onChange={(e) => set("country", e.target.value)}
                  />
                  <FieldDescription>{m.meta_correction_country_hint()}</FieldDescription>
                </Field>

                <Field>
                  <FieldDescription>
                    {m.meta_correction_format_hint({
                      format: formatLabels[event.format] ?? event.format,
                    })}
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </div>
          )}

          {problem !== "" && (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>{problem}</AlertTitle>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {sent ? m.common_close() : m.common_cancel()}
            </DialogClose>
            {!sent && (
              <Button type="submit" disabled={submit.isPending}>
                {submit.isPending ? m.meta_correction_sending() : m.meta_correction_send()}
              </Button>
            )}
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}

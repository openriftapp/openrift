import type { ErrataAnnouncement } from "@openrift/shared/contracts/errata";
import { formatDay } from "@openrift/shared/format-date";
import { CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Textarea } from "@/components/ui/textarea";
import { LanguageSelect } from "@/features/admin/components/language-select";
import type { ErrataDraft } from "@/features/admin/lib/errata-draft";
import { isErrataDraftComplete } from "@/features/admin/lib/errata-draft";

const UNANNOUNCED = "unannounced";

export function ErrataEditor({
  draft,
  announcements,
  languages,
  isPending,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: {
  draft: ErrataDraft;
  announcements: ErrataAnnouncement[];
  languages: { code: string; name: string }[];
  isPending: boolean;
  submitLabel: string;
  onChange: (next: Partial<ErrataDraft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const announcementItems = [
    { value: UNANNOUNCED, label: "None (unannounced change)" },
    ...announcements.map((announcement) => ({
      value: announcement.id,
      label: `${announcement.name} (${formatDay(announcement.publishedOn)})`,
    })),
  ];

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="space-y-1">
        <Label htmlFor="errata-language">Language</Label>
        <LanguageSelect
          id="errata-language"
          className="w-full sm:w-48"
          languages={languages}
          value={draft.language}
          onChange={(language) => onChange({ language })}
          disabled={languages.length < 2}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="errata-rules">Corrected rules text</Label>
          <Textarea
            id="errata-rules"
            className="min-h-16"
            placeholder="Leave empty if only the effect text was corrected"
            value={draft.correctedRulesText}
            onChange={(event) => onChange({ correctedRulesText: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="errata-effect">Corrected effect text</Label>
          <Textarea
            id="errata-effect"
            className="min-h-16"
            placeholder="Leave empty if only the rules text was corrected"
            value={draft.correctedEffectText}
            onChange={(event) => onChange({ correctedEffectText: event.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="errata-announcement">Announcement</Label>
        <SimpleSelect
          id="errata-announcement"
          items={announcementItems}
          value={draft.announcementId === "" ? UNANNOUNCED : draft.announcementId}
          onChange={(next) => onChange({ announcementId: next === UNANNOUNCED ? "" : next })}
          className="w-full sm:w-96"
        />
      </div>

      {draft.announcementId === "" && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1 space-y-1">
            <Label htmlFor="errata-source">Where it was seen (required)</Label>
            <Input
              id="errata-source"
              placeholder="e.g. Riot card gallery"
              value={draft.source}
              onChange={(event) => onChange({ source: event.target.value })}
            />
          </div>
          <div className="min-w-40 flex-1 space-y-1">
            <Label htmlFor="errata-source-url">Source link</Label>
            <Input
              id="errata-source-url"
              placeholder="https://…"
              value={draft.sourceUrl}
              onChange={(event) => onChange({ sourceUrl: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>First seen</Label>
            <DatePicker
              value={draft.effectiveDate || null}
              className="w-44"
              onValueChange={(effectiveDate) => onChange({ effectiveDate })}
              onClear={() => onChange({ effectiveDate: "" })}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button disabled={isPending || !isErrataDraftComplete(draft)} onClick={onSubmit}>
          <CheckIcon />
          {submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

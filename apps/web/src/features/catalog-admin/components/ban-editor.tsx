import { CheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BanDraft } from "@/features/catalog-admin/lib/ban-draft";
import { isBanDraftComplete } from "@/features/catalog-admin/lib/ban-draft";

export function BanEditor({
  draft,
  formats,
  lockedFormatName,
  isPending,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: {
  draft: BanDraft;
  formats: readonly { id: string; name: string }[];
  lockedFormatName: string | null;
  isPending: boolean;
  submitLabel: string;
  onChange: (next: Partial<BanDraft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const options = formats.map((format) => ({ value: format.id, label: format.name }));
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
      {lockedFormatName === null ? (
        <div className="space-y-1">
          <Label>Format</Label>
          <Select
            items={options}
            value={draft.formatId}
            onValueChange={(value) => onChange({ formatId: value ?? "" })}
          >
            <SelectTrigger aria-label="Format" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <Badge variant="destructive" className="self-center">
          {lockedFormatName}
        </Badge>
      )}

      <div className="space-y-1">
        <Label>Banned from</Label>
        <DatePicker
          value={draft.bannedAt || null}
          onChange={(bannedAt) => onChange({ bannedAt })}
          className="w-44"
        />
      </div>

      <div className="min-w-40 flex-1 space-y-1">
        <Label>Reason (optional)</Label>
        <Input
          value={draft.reason}
          placeholder="e.g. Locks the board out of every deck"
          onChange={(event) => onChange({ reason: event.target.value })}
        />
      </div>

      <Button disabled={isPending || !isBanDraftComplete(draft)} onClick={onSubmit}>
        <CheckIcon />
        {submitLabel}
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

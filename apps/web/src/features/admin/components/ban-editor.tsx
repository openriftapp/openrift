import { GLOBAL_CIRCUIT } from "@openrift/shared/types/api/preferences";
import { CheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";
import type { BanDraft } from "@/features/admin/lib/ban-draft";
import { isBanDraftComplete } from "@/features/admin/lib/ban-draft";
import { useCircuitList } from "@/hooks/use-enums";

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
  const circuits = useCircuitList();
  const options = formats.map((format) => ({ value: format.id, label: format.name }));
  const circuitOptions = [
    { value: GLOBAL_CIRCUIT, label: "Global" },
    ...circuits.map((circuit) => ({ value: circuit.slug, label: circuit.label })),
  ];
  const circuitLabel =
    circuits.find((circuit) => circuit.slug === draft.circuit)?.label ?? "Global";
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
      {lockedFormatName === null ? (
        <>
          <div className="space-y-1">
            <Label>Region</Label>
            <SimpleSelect
              items={circuitOptions}
              value={draft.circuit ?? GLOBAL_CIRCUIT}
              onChange={(value) => onChange({ circuit: value === GLOBAL_CIRCUIT ? null : value })}
              label="Region"
              className="w-52"
            />
          </div>
          <div className="space-y-1">
            <Label>Format</Label>
            <SimpleSelect
              items={options}
              value={draft.formatId === "" ? null : draft.formatId}
              onChange={(formatId) => onChange({ formatId })}
              label="Format"
              className="w-40"
            />
          </div>
        </>
      ) : (
        <div className="flex gap-1 self-center">
          <Badge variant="destructive">{lockedFormatName}</Badge>
          <Badge variant="outline">{circuitLabel}</Badge>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="ban-banned-from">Banned from</Label>
        <DatePicker
          id="ban-banned-from"
          value={draft.bannedAt || null}
          onValueChange={(bannedAt) => onChange({ bannedAt })}
          onClear={draft.circuit === null ? undefined : () => onChange({ bannedAt: "" })}
          className="w-44"
        />
        {draft.circuit !== null && (
          <p className="text-muted-foreground text-xs">Empty while the local date is unknown.</p>
        )}
      </div>

      <div className="min-w-40 flex-1 space-y-1">
        <Label>Reason (optional)</Label>
        <Input
          value={draft.reason}
          placeholder="e.g. Locks the board out of every deck"
          onChange={(event) => onChange({ reason: event.target.value })}
        />
      </div>

      <Button disabled={!isBanDraftComplete(draft)} pending={isPending} onClick={onSubmit}>
        <CheckIcon />
        {submitLabel}
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

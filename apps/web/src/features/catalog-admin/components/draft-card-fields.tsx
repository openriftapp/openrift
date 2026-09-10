import { ArrowLeftRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DraftCardFields } from "@/features/catalog-admin/lib/draft-prefill";

function ListField({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          value={values.join(", ")}
          onChange={(event) =>
            onChange(
              event.target.value
                .split(",")
                .map((part) => part.trim())
                .filter((part) => part !== ""),
            )
          }
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Reverse ${label.toLowerCase()} order`}
          disabled={values.length < 2}
          onClick={() => onChange(values.toReversed())}
        >
          <ArrowLeftRightIcon />
        </Button>
      </div>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="w-24 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

interface DraftCardFieldsFormProps {
  fields: DraftCardFields;
  suggestedId: string;
  rulesText: string;
  onChange: (next: Partial<DraftCardFields>) => void;
}

export function DraftCardFieldsForm({
  fields,
  suggestedId,
  rulesText,
  onChange,
}: DraftCardFieldsFormProps) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="draft-name">Name</Label>
        <Input
          id="draft-name"
          value={fields.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="draft-id">Card ID</Label>
        <Input
          id="draft-id"
          value={fields.id}
          className="font-mono"
          placeholder={suggestedId}
          onChange={(event) => onChange({ id: event.target.value })}
        />
      </div>
      <ListField label="Type" values={fields.types} onChange={(types) => onChange({ types })} />
      <ListField
        label="Supertype"
        values={fields.superTypes}
        onChange={(superTypes) => onChange({ superTypes })}
      />
      <ListField
        label="Domains"
        values={fields.domains}
        onChange={(domains) => onChange({ domains })}
      />
      <ListField label="Tags" values={fields.tags} onChange={(tags) => onChange({ tags })} />
      <div className="flex gap-3 md:col-span-2">
        <NumberField
          id="draft-might"
          label="Might"
          value={fields.might}
          onChange={(might) => onChange({ might })}
        />
        <NumberField
          id="draft-energy"
          label="Energy"
          value={fields.energy}
          onChange={(energy) => onChange({ energy })}
        />
        <NumberField
          id="draft-power"
          label="Power"
          value={fields.power}
          onChange={(power) => onChange({ power })}
        />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="draft-rules">Rules text</Label>
        <Textarea id="draft-rules" rows={4} readOnly value={rulesText} />
        <p className="text-muted-foreground text-xs">
          Rules text is stored per printing, so creating the card does not carry it.
        </p>
      </div>
    </section>
  );
}

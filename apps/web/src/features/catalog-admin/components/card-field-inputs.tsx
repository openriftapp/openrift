import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ListField, NumberField } from "@/features/catalog-admin/components/card-form-fields";
import type { CardFieldForm } from "@/features/catalog-admin/lib/card-field-form";
import { EDITABLE_CARD_FIELD_LABELS } from "@/features/catalog-admin/lib/card-field-form";

export function CardFieldInputs({
  form,
  onChange,
  printedText,
}: {
  form: CardFieldForm;
  onChange: (next: Partial<CardFieldForm>) => void;
  printedText: { rules: string | null; effect: string | null } | null;
}) {
  const labels = EDITABLE_CARD_FIELD_LABELS;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="card-name">{labels.name}</Label>
        <Input
          id="card-name"
          value={form.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="card-comment">{labels.comment}</Label>
        <Input
          id="card-comment"
          value={form.comment}
          placeholder="A note for the next reviewer"
          onChange={(event) => onChange({ comment: event.target.value })}
        />
      </div>

      <ListField
        id="card-types"
        label={labels.types}
        values={form.types}
        onChange={(types) => onChange({ types })}
      />
      <ListField
        id="card-super-types"
        label={labels.superTypes}
        values={form.superTypes}
        onChange={(superTypes) => onChange({ superTypes })}
      />
      <ListField
        id="card-domains"
        label={labels.domains}
        values={form.domains}
        onChange={(domains) => onChange({ domains })}
      />
      <ListField
        id="card-tags"
        label={labels.tags}
        values={form.tags}
        onChange={(tags) => onChange({ tags })}
      />

      <div className="flex flex-wrap gap-3 md:col-span-2">
        <NumberField
          id="card-might"
          label={labels.might}
          value={form.might}
          onChange={(might) => onChange({ might })}
        />
        <NumberField
          id="card-might-bonus"
          label={labels.mightBonus}
          value={form.mightBonus}
          onChange={(mightBonus) => onChange({ mightBonus })}
        />
        <NumberField
          id="card-energy"
          label={labels.energy}
          value={form.energy}
          onChange={(energy) => onChange({ energy })}
        />
        <NumberField
          id="card-power"
          label={labels.power}
          value={form.power}
          onChange={(power) => onChange({ power })}
        />
        <NumberField
          id="card-max-copies"
          label={labels.maxCopiesOverride}
          value={form.maxCopiesOverride}
          onChange={(maxCopiesOverride) => onChange({ maxCopiesOverride })}
        />
      </div>

      {printedText === null ? (
        <p className="text-muted-foreground text-sm md:col-span-2">
          Rules and effect text are printed per printing, and this card has no printing yet.
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="card-rules">Rules text</Label>
            <Textarea id="card-rules" rows={4} readOnly value={printedText.rules ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-effect">Effect text</Label>
            <Textarea id="card-effect" rows={4} readOnly value={printedText.effect ?? ""} />
          </div>
          <p className="text-muted-foreground text-sm md:col-span-2">
            Rules and effect text are printed per printing, so they are edited on Printings.
          </p>
        </>
      )}
    </div>
  );
}

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PrintingDraft } from "@/features/catalog-admin/lib/printing-edits";

export function PrintingTextFields({
  printingId,
  draft,
  onPatch,
}: {
  printingId: string;
  draft: PrintingDraft;
  onPatch: (next: Partial<PrintingDraft>) => void;
}) {
  const fieldId = (name: string) => `printing-${printingId}-${name}`;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Field>
        <FieldLabel htmlFor={fieldId("comment")}>Comment</FieldLabel>
        <Input
          id={fieldId("comment")}
          value={draft.comment}
          onChange={(event) => onPatch({ comment: event.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={fieldId("rules")}>Printed rules text</FieldLabel>
        <Textarea
          id={fieldId("rules")}
          rows={3}
          value={draft.printedRulesText}
          onChange={(event) => onPatch({ printedRulesText: event.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={fieldId("effect")}>Printed effect text</FieldLabel>
        <Textarea
          id={fieldId("effect")}
          rows={3}
          value={draft.printedEffectText}
          onChange={(event) => onPatch({ printedEffectText: event.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={fieldId("flavor")}>Flavor text</FieldLabel>
        <Textarea
          id={fieldId("flavor")}
          rows={2}
          value={draft.flavorText}
          onChange={(event) => onPatch({ flavorText: event.target.value })}
        />
      </Field>
    </div>
  );
}

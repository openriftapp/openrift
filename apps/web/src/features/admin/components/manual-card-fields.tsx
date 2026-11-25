import { enumLabel } from "@openrift/shared/enum-label";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { useManualCardDraft } from "@/features/admin/hooks/use-manual-card-draft";
import { MANUAL_CARD_STATS } from "@/features/admin/hooks/use-manual-card-draft";
import { CARD_FIELD_LABELS, CARD_ID_LABEL } from "@/features/admin/lib/catalog-field-labels";
import { ChipInput } from "@/features/contribute/components/form-fields";
import { useEnumOrders } from "@/hooks/use-enums";
import { parseIntegerInput } from "@/lib/integer-input";

export function ManualCardFields({
  draft,
  idPrefix,
}: {
  draft: ReturnType<typeof useManualCardDraft>;
  idPrefix: string;
}) {
  const { orders, labels } = useEnumOrders();
  const { setTypes, setDomains, setSuperTypes, setTags } = draft;
  const groups = [
    {
      label: `${CARD_FIELD_LABELS.types} *`,
      value: draft.types,
      handleChange: setTypes,
      slugs: orders.cardTypes,
      map: labels.cardTypes,
    },
    {
      label: `${CARD_FIELD_LABELS.domains} *`,
      value: draft.domains,
      handleChange: setDomains,
      slugs: orders.domains,
      map: labels.domains,
    },
    {
      label: CARD_FIELD_LABELS.superTypes,
      value: draft.superTypes,
      handleChange: setSuperTypes,
      slugs: orders.superTypes,
      map: labels.superTypes,
    },
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-name`}>{CARD_FIELD_LABELS.name} *</FieldLabel>
          <Input
            id={`${idPrefix}-name`}
            value={draft.name}
            onChange={(event) => draft.setName(event.target.value)}
            placeholder="e.g. Jinx, Rebel"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-slug`}>{CARD_ID_LABEL} *</FieldLabel>
          <Input
            id={`${idPrefix}-slug`}
            value={draft.slugInput}
            onChange={(event) => draft.setSlug(event.target.value)}
            placeholder="made from the name"
            className="font-mono"
          />
        </Field>
      </div>
      {groups.map((group) => (
        <Field key={group.label}>
          <FieldLabel>{group.label}</FieldLabel>
          <ToggleGroup
            multiple
            variant="outline"
            spacing={2}
            value={group.value}
            onValueChange={group.handleChange}
            className="w-full flex-wrap"
          >
            {group.slugs.map((slug) => (
              <ToggleGroupItem key={slug} value={slug}>
                {enumLabel(group.map, slug)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      ))}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {MANUAL_CARD_STATS.map(({ key, label }) => {
          const invalid = parseIntegerInput(draft.numeric[key]) === undefined;
          return (
            <Field key={key} data-invalid={invalid}>
              <FieldLabel htmlFor={`${idPrefix}-${key}`}>{label}</FieldLabel>
              <Input
                id={`${idPrefix}-${key}`}
                type="number"
                min={0}
                aria-invalid={invalid}
                value={draft.numeric[key]}
                onChange={(event) => draft.setStat(key, event.target.value)}
                className="no-spinner"
              />
              {invalid && <FieldError>Whole number</FieldError>}
            </Field>
          );
        })}
      </div>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-tags`}>{CARD_FIELD_LABELS.tags}</FieldLabel>
        <ChipInput
          id={`${idPrefix}-tags`}
          value={draft.tags}
          onChange={setTags}
          placeholder="Press Enter or comma to add"
        />
      </Field>
    </>
  );
}

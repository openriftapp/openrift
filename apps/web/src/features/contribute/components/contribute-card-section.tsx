import { enumLabel } from "@openrift/shared/enum-label";
import { useState } from "react";

import { SettingsSection } from "@/components/layout/settings-section";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CatalogCardPicker } from "@/features/cards/components/catalog-card-picker";
import { DomainIcon } from "@/features/cards/components/domain-icon";
import type { PlaceholderField } from "@/features/cards/lib/card-placeholder-regions";
import { ChipInput, FieldRow, NumberInput } from "@/features/contribute/components/form-fields";
import type { ContributeFormApi } from "@/features/contribute/hooks/use-contribute-form";
import type { ContributeFormCard } from "@/features/contribute/lib/contribute-json";
import { prefillFromCatalogCard } from "@/features/contribute/lib/contribute-json";
import { useEnumOrders } from "@/hooks/use-enums";
import { computeDomainDisabled } from "@/lib/domain";
import { m } from "@/paraglide/messages.js";

interface ContributeCardSectionProps extends Pick<
  ContributeFormApi,
  "form" | "errorAt" | "setCardField" | "prefillFromExisting"
> {
  lockedSlug?: string;
  reveal?: PlaceholderField | null;
}

function hasCardDetails(card: ContributeFormCard): boolean {
  return (
    card.domains.length > 0 ||
    card.types.length > 0 ||
    card.superTypes.length > 0 ||
    card.tags.length > 0 ||
    card.might !== null ||
    card.energy !== null ||
    card.power !== null ||
    card.mightBonus !== null
  );
}

export function ContributeCardSection({
  form,
  errorAt,
  setCardField,
  prefillFromExisting,
  lockedSlug,
  reveal,
}: ContributeCardSectionProps) {
  const [open, setOpen] = useState(() => hasCardDetails(form.card));
  const [lastReveal, setLastReveal] = useState(reveal ?? null);
  if (reveal !== undefined && reveal !== lastReveal) {
    setLastReveal(reveal);
    if (reveal !== null && reveal !== "card.name") {
      setOpen(true);
    }
  }
  const { orders, labels } = useEnumOrders();
  const domainDisabled = computeDomainDisabled(form.card.domains, orders.domains);

  return (
    <SettingsSection
      title={m.contribute_card_section_title()}
      action={
        lockedSlug ? undefined : (
          <CatalogCardPicker
            label={m.contribute_picker_select_existing()}
            variant="ghost"
            onPick={(card, catalog, cardId) =>
              prefillFromExisting(prefillFromCatalogCard(cardId, card, catalog))
            }
          />
        )
      }
      contentClassName="gap-8"
    >
      <FieldRow
        label={m.contribute_field_name()}
        required
        field="card.name"
        error={errorAt("card.name") ?? errorAt("slug")}
      >
        <Input
          value={form.card.name}
          onChange={(e) => setCardField("name", e.target.value)}
          placeholder="Ahri, Alluring"
        />
      </FieldRow>

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          render={
            <ExpandToggle expanded={open} className="text-muted-foreground hover:text-foreground">
              {m.contribute_card_details()}
            </ExpandToggle>
          }
        />
        <CollapsibleContent className="mt-6 flex flex-col gap-4">
          <FieldRow label={m.contribute_field_domains()} field="card.domains">
            <ToggleGroup
              multiple
              variant="outline"
              spacing={0}
              value={form.card.domains}
              onValueChange={(next) => setCardField("domains", next)}
            >
              {orders.domains.map((slug) => {
                const selected = form.card.domains.includes(slug);
                const disabled = !selected && domainDisabled.has(slug);
                return (
                  <ToggleGroupItem key={slug} value={slug} disabled={disabled}>
                    <DomainIcon domain={slug} decorative className="size-4 shrink-0" />
                    {enumLabel(labels.domains, slug)}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </FieldRow>
          <FieldRow label={m.contribute_field_types()} field="card.types">
            <ToggleGroup
              multiple
              variant="outline"
              spacing={0}
              value={form.card.types}
              onValueChange={(next) => setCardField("types", next)}
            >
              {orders.cardTypes.map((slug) => (
                <ToggleGroupItem key={slug} value={slug}>
                  {enumLabel(labels.cardTypes, slug)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label={m.contribute_field_supertypes()}>
              <ToggleGroup
                multiple
                variant="outline"
                spacing={0}
                value={form.card.superTypes}
                onValueChange={(next) => setCardField("superTypes", next)}
              >
                {orders.superTypes.map((slug) => (
                  <ToggleGroupItem key={slug} value={slug}>
                    {enumLabel(labels.superTypes, slug)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldRow>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <FieldRow label={m.contribute_field_might()} field="card.might">
              <NumberInput value={form.card.might} onChange={(v) => setCardField("might", v)} />
            </FieldRow>
            <FieldRow label={m.contribute_field_energy()} field="card.energy">
              <NumberInput value={form.card.energy} onChange={(v) => setCardField("energy", v)} />
            </FieldRow>
            <FieldRow label={m.contribute_field_power()} field="card.power">
              <NumberInput value={form.card.power} onChange={(v) => setCardField("power", v)} />
            </FieldRow>
            <FieldRow label={m.contribute_field_might_bonus()} field="card.mightBonus">
              <NumberInput
                value={form.card.mightBonus}
                onChange={(v) => setCardField("mightBonus", v)}
              />
            </FieldRow>
          </div>
          <FieldRow
            label={m.contribute_field_tags()}
            hint={m.contribute_field_tags_hint()}
            field="card.tags"
          >
            <ChipInput
              value={form.card.tags}
              onChange={(v) => setCardField("tags", v)}
              placeholder="Poro"
            />
          </FieldRow>
        </CollapsibleContent>
      </Collapsible>
    </SettingsSection>
  );
}

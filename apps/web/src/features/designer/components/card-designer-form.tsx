import { enumLabel } from "@openrift/shared/enum-label";
import type { Domain, Rarity } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { EraserIcon } from "lucide-react";

import { SettingsRow } from "@/components/layout/settings-row";
import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CardTextInput } from "@/features/contribute/components/card-text-input";
import {
  ChipInput,
  FieldRow,
  NumberInput,
  SingleSelect,
} from "@/features/contribute/components/form-fields";
import { useCardDesignerStore } from "@/features/designer/stores/card-designer-store";
import { useEnumOrders } from "@/hooks/use-enums";
import { computeDomainDisabled } from "@/lib/domain";
import { getFilterIconPath } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/**
 * Reuses the contribute form's inputs but drops printing-catalog metadata
 * (set, language, year, markers, finish, art variant, signed) since this
 * designs an invented card.
 */
export function CardDesignerForm() {
  const card = useCardDesignerStore((state) => state.card);
  const setCardField = useCardDesignerStore((state) => state.setCardField);
  const showAttribution = useCardDesignerStore((state) => state.showAttribution);
  const setShowAttribution = useCardDesignerStore((state) => state.setShowAttribution);
  const reset = useCardDesignerStore((state) => state.reset);
  const { orders, labels } = useEnumOrders();

  const domainDisabled = computeDomainDisabled(card.domains, orders.domains);
  const domainIcons = Object.fromEntries(
    orders.domains.map((slug) => [slug, getFilterIconPath("domains", slug)]),
  );

  return (
    <SettingsSection
      title={m.designer_form_title()}
      action={
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          <EraserIcon className="size-4" />
          {m.designer_form_clear()}
        </Button>
      }
      contentClassName="gap-8"
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label={m.designer_field_name()}>
            <Input
              value={card.name}
              onChange={(e) => setCardField("name", e.target.value)}
              placeholder="Sir Pounce, Lord of Naps"
            />
          </FieldRow>
          <FieldRow label={m.designer_field_type()}>
            <SingleSelect
              value={card.type || null}
              onChange={(value) => setCardField("type", value ?? "")}
              options={orders.cardTypes}
              labels={labels.cardTypes}
              placeholder={m.designer_type_placeholder()}
            />
          </FieldRow>
        </div>

        <FieldRow label={m.designer_field_domains()}>
          <ToggleGroup
            multiple
            variant="outline"
            spacing={1}
            className="flex-wrap"
            value={card.domains}
            onValueChange={(next) => setCardField("domains", next as Domain[])}
          >
            {orders.domains.map((slug) => {
              const selected = card.domains.includes(slug as Domain);
              const disabled = !selected && domainDisabled.has(slug);
              const iconSrc = domainIcons[slug];
              const isColorless = slug === WellKnown.domain.COLORLESS;
              return (
                <ToggleGroupItem key={slug} value={slug} disabled={disabled}>
                  {iconSrc && (
                    <img
                      src={iconSrc}
                      alt=""
                      className={cn("size-4 shrink-0", isColorless && "brightness-0 dark:invert")}
                    />
                  )}
                  {enumLabel(labels.domains, slug)}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </FieldRow>

        <FieldRow label={m.designer_field_supertypes()}>
          <ToggleGroup
            multiple
            variant="outline"
            spacing={1}
            className="flex-wrap"
            value={card.superTypes}
            onValueChange={(next) => setCardField("superTypes", next)}
          >
            {orders.superTypes.map((slug) => (
              <ToggleGroupItem key={slug} value={slug}>
                {enumLabel(labels.superTypes, slug)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </FieldRow>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <FieldRow label={m.designer_field_energy()}>
            <NumberInput value={card.energy} onChange={(value) => setCardField("energy", value)} />
          </FieldRow>
          <FieldRow label={m.designer_field_might()}>
            <NumberInput value={card.might} onChange={(value) => setCardField("might", value)} />
          </FieldRow>
          <FieldRow label={m.designer_field_power()}>
            <NumberInput value={card.power} onChange={(value) => setCardField("power", value)} />
          </FieldRow>
          <FieldRow label={m.designer_field_might_bonus()}>
            <NumberInput
              value={card.mightBonus}
              onChange={(value) => setCardField("mightBonus", value)}
            />
          </FieldRow>
        </div>

        <FieldRow label={m.designer_field_tags()} hint={m.designer_field_tags_hint()}>
          <ChipInput
            value={card.tags}
            onChange={(value) => setCardField("tags", value)}
            placeholder="Cat"
          />
        </FieldRow>
      </div>

      <div className="flex flex-col gap-4">
        <CardTextInput
          label={m.designer_field_rules_text()}
          value={card.rulesText}
          onChange={(value) => setCardField("rulesText", value)}
        />
        <CardTextInput
          label={m.designer_field_effect_text()}
          value={card.effectText}
          onChange={(value) => setCardField("effectText", value)}
        />
        <FieldRow label={m.designer_field_flavor_text()}>
          <Textarea
            rows={2}
            value={card.flavorText}
            onChange={(e) => setCardField("flavorText", e.target.value)}
          />
        </FieldRow>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FieldRow label={m.designer_field_rarity()}>
          <SingleSelect
            value={card.rarity}
            onChange={(value) => setCardField("rarity", value as Rarity | null)}
            options={orders.rarities}
            labels={labels.rarities}
            placeholder={m.designer_rarity_placeholder()}
          />
        </FieldRow>
        <FieldRow label={m.designer_field_code()}>
          <Input
            value={card.publicCode}
            onChange={(e) => setCardField("publicCode", e.target.value)}
            placeholder="MEOW-009/009"
          />
        </FieldRow>
        <FieldRow label={m.designer_field_artist()}>
          <Input
            value={card.artist}
            onChange={(e) => setCardField("artist", e.target.value)}
            placeholder="Whiskers von Catsworth"
          />
        </FieldRow>
      </div>

      <SettingsRow label={m.designer_attribution_label()} htmlFor="card-designer-attribution">
        <Switch
          id="card-designer-attribution"
          checked={showAttribution}
          onCheckedChange={setShowAttribution}
        />
      </SettingsRow>
    </SettingsSection>
  );
}

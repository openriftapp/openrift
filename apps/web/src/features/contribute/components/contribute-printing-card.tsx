import type { VariantLabelPrinting } from "@openrift/shared/printing-label";
import type { SetListResponse } from "@openrift/shared/types/api/catalog";
import type { EnumOrders } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { CopyIcon, LinkIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { PrintingVariantLabel } from "@/features/cards/components/printing-label";
import type { PlaceholderField } from "@/features/cards/lib/card-placeholder-regions";
import { CardTextInput } from "@/features/contribute/components/card-text-input";
import type { LabelledControlProps } from "@/features/contribute/components/form-fields";
import {
  FieldRow,
  MultiSelectDropdown,
  NumberInput,
  SingleSelect,
} from "@/features/contribute/components/form-fields";
import type { ContributeFormPrinting } from "@/features/contribute/lib/contribute-json";
import { isBlankPrinting } from "@/features/contribute/lib/contribute-printing-labels";
import { resolveSetFromPublicCode } from "@/features/contribute/lib/contribute-set-code";
import type { EnumLabels } from "@/lib/enum-labels";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface PrintingCardProps {
  index: number;
  printing: ContributeFormPrinting;
  variant?: VariantLabelPrinting;
  siblings: VariantLabelPrinting[];
  open: boolean;
  hasError: boolean;
  onToggle: () => void;
  errorAt: (path: string) => string | undefined;
  sets: SetListResponse["sets"];
  languages: { code: string; name: string }[];
  markers: { slug: string; label: string }[];
  channels: { slug: string; label: string }[];
  orders: EnumOrders;
  labels: EnumLabels;
  onChange: <K extends keyof ContributeFormPrinting>(
    key: K,
    value: ContributeFormPrinting[K],
  ) => void;
  onCopy?: () => void;
  onRemove?: () => void;
  collapsible?: boolean;
  reveal?: PlaceholderField | null;
}

const PRINTING_DETAIL_FIELDS = new Set<PlaceholderField>([
  "printing.rarity",
  "printing.artist",
  "printing.printedRulesText",
  "printing.printedEffectText",
  "printing.flavorText",
]);

export function PrintingCard({
  index,
  printing,
  variant,
  siblings,
  open,
  hasError,
  onToggle,
  errorAt,
  sets,
  languages,
  markers,
  channels,
  orders,
  labels,
  onChange,
  onCopy,
  onRemove,
  collapsible = true,
  reveal,
}: PrintingCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rareOpen, setRareOpen] = useState(false);
  const [lastReveal, setLastReveal] = useState(reveal ?? null);
  if (reveal !== undefined && reveal !== lastReveal) {
    setLastReveal(reveal);
    if (reveal !== null && PRINTING_DETAIL_FIELDS.has(reveal)) {
      setDetailsOpen(true);
    }
  }
  const setOptions = sets.map((s) => ({ slug: s.slug, name: s.name }));
  const resolvedSet = resolveSetFromPublicCode(printing.publicCode, setOptions);
  const codeEntered = (printing.publicCode ?? "").trim() !== "";

  const handleSetChange = (slug: string | null) => {
    onChange("setId", slug);
    const matched = sets.find((s) => s.slug === slug);
    onChange("setName", matched?.name ?? null);
  };

  const handleCodeChange = (next: string) => {
    onChange("publicCode", next || null);
    const matched = resolveSetFromPublicCode(next, setOptions);
    onChange("setId", matched?.slug ?? null);
    onChange("setName", matched?.name ?? null);
  };

  return (
    <Card className={cn(!open && "py-3")}>
      <CardHeader>
        <CardTitle className="min-w-0">
          <ExpandToggle
            expanded={open}
            onClick={onToggle}
            disabled={!collapsible}
            className="w-full min-w-0"
          >
            {variant && (
              <PrintingVariantLabel
                printing={variant}
                siblings={siblings}
                fallback={
                  isBlankPrinting(printing)
                    ? m.contribute_printing_new()
                    : m.contribute_printing_standard()
                }
                className="min-w-0"
              />
            )}
            {printing.publicCode && (
              <span className="text-muted-foreground truncate font-normal">
                {printing.publicCode}
              </span>
            )}
            {hasError && (
              <>
                <TriangleAlertIcon className="text-destructive size-4 shrink-0" aria-hidden />
                <span className="sr-only">{m.contribute_printing_has_problem()}</span>
              </>
            )}
          </ExpandToggle>
        </CardTitle>
        <CardAction className="flex gap-1">
          {onCopy && (
            <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
              <CopyIcon className="size-4" />
              {m.contribute_printing_copy()}
            </Button>
          )}
          {onRemove && (
            <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
              <Trash2Icon className="size-4" />
              {m.contribute_printing_remove()}
            </Button>
          )}
        </CardAction>
      </CardHeader>
      {open && (
        <CardContent className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow
                label={m.contribute_field_code()}
                required
                field="printing.publicCode"
                error={errorAt(`printings[${index.toString()}].publicCode`)}
              >
                <Input
                  value={printing.publicCode ?? ""}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="OGN-066/298"
                />
              </FieldRow>
              <FieldRow
                label={m.contribute_field_image_url()}
                hint={m.contribute_hint_image_url()}
                error={errorAt(`printings[${index.toString()}].imageUrl`)}
              >
                <ImageUrlInput
                  value={printing.imageUrl ?? ""}
                  onChange={(next) => onChange("imageUrl", next || null)}
                />
              </FieldRow>
            </div>

            {codeEntered &&
              (resolvedSet ? (
                <p className="text-muted-foreground text-sm">
                  {m.contribute_printing_set_resolved({ name: resolvedSet.name })}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-muted-foreground text-sm">
                    {m.contribute_printing_set_unknown()}
                  </p>
                  <FieldRow label={m.contribute_field_set()}>
                    <SingleSelect
                      value={printing.setId}
                      onChange={handleSetChange}
                      options={sets.map((s) => s.slug)}
                      labels={Object.fromEntries(sets.map((s) => [s.slug, s.name]))}
                      placeholder={m.contribute_placeholder_set()}
                    />
                  </FieldRow>
                </div>
              ))}
          </div>

          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger
              render={
                <ExpandToggle
                  expanded={detailsOpen}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {m.contribute_printing_details()}
                </ExpandToggle>
              }
            />
            <CollapsibleContent className="mt-6 flex flex-col gap-8">
              <div className="flex flex-col gap-4">
                <FieldRow label={m.contribute_field_name()} hint={m.contribute_hint_printed_name()}>
                  <Input
                    value={printing.printedName}
                    onChange={(e) => onChange("printedName", e.target.value)}
                  />
                </FieldRow>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FieldRow
                    label={m.contribute_field_language()}
                    error={errorAt(`printings[${index.toString()}].language`)}
                  >
                    <SingleSelect
                      value={printing.language}
                      onChange={(v) => onChange("language", v)}
                      options={languages.map((language) => language.code)}
                      labels={Object.fromEntries(
                        languages.map((language) => [language.code, language.name]),
                      )}
                      placeholder={m.contribute_placeholder_language()}
                    />
                  </FieldRow>
                  <FieldRow label={m.contribute_field_rarity()} field="printing.rarity">
                    <SingleSelect
                      value={printing.rarity}
                      onChange={(v) => onChange("rarity", v)}
                      options={orders.rarities}
                      labels={labels.rarities}
                      placeholder={m.contribute_placeholder_rarity()}
                    />
                  </FieldRow>
                  <FieldRow label={m.contribute_field_finish()}>
                    <SingleSelect
                      value={printing.finish}
                      onChange={(v) => onChange("finish", v)}
                      options={orders.finishes}
                      labels={labels.finishes}
                      placeholder={m.contribute_placeholder_finish()}
                    />
                  </FieldRow>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FieldRow label={m.contribute_field_art_variant()}>
                    <SingleSelect
                      value={printing.artVariant}
                      onChange={(v) => onChange("artVariant", v)}
                      options={orders.artVariants}
                      labels={labels.artVariants}
                      placeholder={m.contribute_placeholder_art_variant()}
                    />
                  </FieldRow>
                  <FieldRow label={m.contribute_field_artist()} field="printing.artist">
                    <Input
                      value={printing.artist ?? ""}
                      onChange={(e) => onChange("artist", e.target.value || null)}
                    />
                  </FieldRow>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FieldRow label={m.contribute_field_signed()}>
                    <Switch
                      checked={printing.isSigned}
                      onCheckedChange={(checked) => onChange("isSigned", checked)}
                      className="mt-1"
                    />
                  </FieldRow>
                  <FieldRow label={m.contribute_field_overnumbered()}>
                    <Switch
                      checked={printing.isOvernumbered}
                      onCheckedChange={(checked) => onChange("isOvernumbered", checked)}
                      className="mt-1"
                    />
                  </FieldRow>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <CardTextInput
                  label={m.contribute_field_rules_text()}
                  field="printing.printedRulesText"
                  value={printing.printedRulesText ?? ""}
                  onChange={(v) => onChange("printedRulesText", v || null)}
                />
                <CardTextInput
                  label={m.contribute_field_effect_text()}
                  field="printing.printedEffectText"
                  value={printing.printedEffectText ?? ""}
                  onChange={(v) => onChange("printedEffectText", v || null)}
                />
                <CardTextInput
                  label={m.contribute_field_flavor_text()}
                  field="printing.flavorText"
                  variant="flavor"
                  value={printing.flavorText ?? ""}
                  onChange={(v) => onChange("flavorText", v || null)}
                />
              </div>

              <Collapsible open={rareOpen} onOpenChange={setRareOpen}>
                <CollapsibleTrigger
                  render={
                    <ExpandToggle
                      expanded={rareOpen}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {m.contribute_printing_rarely_needed()}
                    </ExpandToggle>
                  }
                />
                <CollapsibleContent className="mt-6 grid gap-4 sm:grid-cols-2">
                  <FieldRow label={m.contribute_field_size()}>
                    <SingleSelect
                      value={printing.size}
                      onChange={(v) => onChange("size", v ?? WellKnown.cardSize.STANDARD)}
                      options={orders.cardSizes}
                      labels={labels.cardSizes}
                      placeholder={m.contribute_placeholder_size()}
                    />
                  </FieldRow>
                  <FieldRow
                    label={m.contribute_field_year()}
                    hint={m.contribute_hint_year()}
                    error={errorAt(`printings[${index.toString()}].printedYear`)}
                  >
                    <NumberInput
                      value={printing.printedYear}
                      onChange={(v) => onChange("printedYear", v)}
                    />
                  </FieldRow>
                  <FieldRow
                    label={m.contribute_field_markers_labelled()}
                    hint={m.contribute_hint_markers()}
                  >
                    <MultiSelectDropdown
                      value={printing.markerSlugs}
                      onChange={(v) => onChange("markerSlugs", v)}
                      options={markers}
                      placeholder={m.contribute_none()}
                    />
                  </FieldRow>
                  <FieldRow
                    label={m.contribute_field_channels()}
                    hint={m.contribute_hint_channels()}
                  >
                    <MultiSelectDropdown
                      value={printing.distributionChannelSlugs}
                      onChange={(v) => onChange("distributionChannelSlugs", v)}
                      options={channels}
                      placeholder={m.contribute_none()}
                    />
                  </FieldRow>
                </CollapsibleContent>
              </Collapsible>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      )}
    </Card>
  );
}

function ImageUrlInput({
  value,
  onChange,
  id,
  "aria-labelledby": ariaLabelledBy,
}: LabelledControlProps & {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <InputGroup>
      <InputGroupAddon>
        <LinkIcon />
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        aria-labelledby={ariaLabelledBy}
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://..."
      />
    </InputGroup>
  );
}

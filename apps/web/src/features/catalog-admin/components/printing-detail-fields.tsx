import { enumLabel } from "@openrift/shared/enum-label";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSets } from "@/features/cards/hooks/use-sets";
import { buildChannelTree, leafChannels } from "@/features/cards/lib/distribution-channel-tree";
import { PrintingSelectField } from "@/features/catalog-admin/components/printing-select-field";
import type { PrintingDraft } from "@/features/catalog-admin/lib/printing-edits";
import { MultiSelectDropdown } from "@/features/contribute/components/form-fields";
import { useDistributionChannels } from "@/hooks/use-distribution-channels";
import { useEnumOrders } from "@/hooks/use-enums";
import { useLanguages } from "@/hooks/use-languages";
import { useMarkers } from "@/hooks/use-markers";

type EnumGroup = "rarities" | "artVariants" | "finishes" | "cardSizes";

export function PrintingDetailFields({
  printingId,
  draft,
  onPatch,
}: {
  printingId: string;
  draft: PrintingDraft;
  onPatch: (next: Partial<PrintingDraft>) => void;
}) {
  const fieldId = (name: string) => `printing-${printingId}-${name}`;
  const { orders, labels } = useEnumOrders();
  const { data: setsData } = useSets();
  const { data: markersData } = useMarkers();
  const { data: languagesData } = useLanguages();
  const { data: channelsData } = useDistributionChannels();

  const enumOptions = (group: EnumGroup) =>
    orders[group].map((slug) => ({ value: slug, label: enumLabel(labels[group], slug) }));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field>
        <FieldLabel htmlFor={fieldId("short-code")}>Short code</FieldLabel>
        <Input
          id={fieldId("short-code")}
          value={draft.shortCode}
          className="font-mono"
          onChange={(event) => onPatch({ shortCode: event.target.value })}
        />
      </Field>
      <PrintingSelectField
        label="Set"
        value={draft.setId}
        options={setsData.sets.map((set) => ({ value: set.slug, label: set.name }))}
        onChange={(setId) => onPatch({ setId })}
      />
      <PrintingSelectField
        label="Rarity"
        value={draft.rarity}
        options={enumOptions("rarities")}
        onChange={(rarity) => onPatch({ rarity })}
      />
      <PrintingSelectField
        label="Finish"
        value={draft.finish}
        options={enumOptions("finishes")}
        onChange={(finish) => onPatch({ finish })}
      />
      <PrintingSelectField
        label="Size"
        value={draft.size}
        options={enumOptions("cardSizes")}
        onChange={(size) => onPatch({ size })}
      />
      <PrintingSelectField
        label="Art variant"
        value={draft.artVariant}
        options={enumOptions("artVariants")}
        onChange={(artVariant) => onPatch({ artVariant })}
      />
      <PrintingSelectField
        label="Language"
        value={draft.language}
        options={languagesData.languages.map((language) => ({
          value: language.code,
          label: `${language.name} (${language.code})`,
        }))}
        onChange={(language) => onPatch({ language })}
      />
      <Field>
        <FieldLabel htmlFor={fieldId("artist")}>Artist</FieldLabel>
        <Input
          id={fieldId("artist")}
          value={draft.artist}
          onChange={(event) => onPatch({ artist: event.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={fieldId("public-code")}>Public code</FieldLabel>
        <Input
          id={fieldId("public-code")}
          value={draft.publicCode}
          className="font-mono"
          onChange={(event) => onPatch({ publicCode: event.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={fieldId("printed-name")}>Printed name</FieldLabel>
        <Input
          id={fieldId("printed-name")}
          value={draft.printedName}
          onChange={(event) => onPatch({ printedName: event.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={fieldId("printed-year")}>Printed year</FieldLabel>
        <Input
          id={fieldId("printed-year")}
          value={draft.printedYear}
          inputMode="numeric"
          onChange={(event) => onPatch({ printedYear: event.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={fieldId("markers")}>Markers</FieldLabel>
        <MultiSelectDropdown
          id={fieldId("markers")}
          options={markersData.markers
            .map((marker) => ({ slug: marker.slug, label: marker.label }))
            .toSorted((a, b) => a.label.localeCompare(b.label))}
          value={draft.markerSlugs}
          onChange={(markerSlugs) => onPatch({ markerSlugs })}
          placeholder="Select markers…"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={fieldId("channels")}>Distribution channels</FieldLabel>
        <MultiSelectDropdown
          id={fieldId("channels")}
          options={leafChannels(buildChannelTree(channelsData.distributionChannels))
            .map((node) => ({ slug: node.channel.slug, label: node.breadcrumb }))
            .toSorted((a, b) => a.label.localeCompare(b.label))}
          value={draft.distributionChannelSlugs}
          onChange={(distributionChannelSlugs) => onPatch({ distributionChannelSlugs })}
          placeholder="Select channels…"
        />
      </Field>
      <Field orientation="horizontal" className="self-end">
        <Checkbox
          id={fieldId("signed")}
          checked={draft.isSigned}
          onCheckedChange={(isSigned) => onPatch({ isSigned })}
        />
        <FieldLabel htmlFor={fieldId("signed")}>Signed</FieldLabel>
      </Field>
      <Field orientation="horizontal" className="self-end">
        <Checkbox
          id={fieldId("overnumbered")}
          checked={draft.isOvernumbered}
          onCheckedChange={(isOvernumbered) => onPatch({ isOvernumbered })}
        />
        <FieldLabel htmlFor={fieldId("overnumbered")}>Overnumbered</FieldLabel>
      </Field>
    </div>
  );
}

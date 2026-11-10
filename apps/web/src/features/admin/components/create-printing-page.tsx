import type { CreatePrintingBody } from "@openrift/shared/contracts/admin/card-mutations";
import { enumLabel } from "@openrift/shared/enum-label";
import { fixTypography } from "@openrift/shared/fix-typography";
import { setSlugFromShortCode, shortCodeFromPublicCode } from "@openrift/shared/printing-code";
import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import { WellKnown } from "@openrift/shared/well-known";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { ComboboxPicker } from "@/components/combobox-picker";
import { PageDescription } from "@/components/layout/page-top-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { useCreatePrinting } from "@/features/admin/hooks/use-admin-card-mutations";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import { useDistributionChannels } from "@/features/admin/hooks/use-distribution-channels";
import { useLanguages } from "@/features/admin/hooks/use-languages";
import { useMarkers } from "@/features/admin/hooks/use-markers";
import { useSets } from "@/features/cards/hooks/use-sets";
import { buildChannelTree, leafChannels } from "@/features/cards/lib/distribution-channel-tree";
import { printingFormDefaults } from "@/features/cards/lib/printing-form-defaults";
import { CardTextInput } from "@/features/contribute/components/card-text-input";
import { useEnumOrders } from "@/hooks/use-enums";
import { useCostKeywords } from "@/hooks/use-keyword-styles";
import { errorText } from "@/lib/error-text";

const routeApi = getRouteApi("/_app/_authenticated/admin/cards_/$cardSlug_/printings/create");

export function CreatePrintingPage() {
  const { cardSlug } = routeApi.useParams();
  const { duplicateFrom } = routeApi.useSearch();
  const navigate = useNavigate();
  const createPrinting = useCreatePrinting();
  const { data: cardDetail, isLoading } = useAdminCardDetail(cardSlug) as {
    data: AdminCardDetailResponse | undefined;
    isLoading: boolean;
  };
  const { data: setsData } = useSets();
  const { data: markersData } = useMarkers();
  const { data: languagesData } = useLanguages();
  const { data: channelsData } = useDistributionChannels();
  const { orders, labels } = useEnumOrders();
  const costKeywords = useCostKeywords();
  const reformatRules = (value: string) => fixTypography(value, { costKeywords });
  const reformatFlavor = (value: string) =>
    fixTypography(value, { italicParens: false, keywordGlyphs: false });

  const sets = setsData.sets;
  const markers = markersData.markers;
  const languages = languagesData.languages;
  const channelOptions = leafChannels(buildChannelTree(channelsData.distributionChannels))
    .map((node) => ({ value: node.channel.slug, label: node.breadcrumb }))
    .toSorted((a, b) => a.label.localeCompare(b.label));

  const source = duplicateFrom
    ? (cardDetail?.printings.find((p) => p.id === duplicateFrom) ?? null)
    : null;
  const defaults = printingFormDefaults(source, {
    setSlug: sets[0]?.slug ?? "",
    rarity: orders.rarities[0] ?? WellKnown.rarity.COMMON,
    artVariant: orders.artVariants[0] ?? "normal",
    finish: orders.finishes[0] ?? "normal",
    size: orders.cardSizes[0] ?? WellKnown.cardSize.STANDARD,
    language: languages[0]?.code ?? WellKnown.language.EN,
  });

  const [rarity, setRarity] = useState<string>(defaults.rarity);
  const [artVariant, setArtVariant] = useState<string>(defaults.artVariant);
  const [finish, setFinish] = useState<string>(defaults.finish);
  const [size, setSize] = useState<string>(defaults.size);
  const [isSigned, setIsSigned] = useState(defaults.isSigned);
  const [isOvernumbered, setIsOvernumbered] = useState(defaults.isOvernumbered);
  const [selectedMarkerSlugs, setSelectedMarkerSlugs] = useState<string[]>(defaults.markerSlugs);
  const [selectedChannelSlugs, setSelectedChannelSlugs] = useState<string[]>(
    defaults.distributionChannelSlugs,
  );
  const [artist, setArtist] = useState(defaults.artist);
  const [publicCode, setPublicCode] = useState(defaults.publicCode);
  const [language, setLanguage] = useState<string>(defaults.language);
  const [printedName, setPrintedName] = useState(defaults.printedName);
  const [printedYear, setPrintedYear] = useState<string>(defaults.printedYear);
  const [printedRulesText, setPrintedRulesText] = useState(defaults.printedRulesText);
  const [printedEffectText, setPrintedEffectText] = useState(defaults.printedEffectText);
  const [flavorText, setFlavorText] = useState(defaults.flavorText);
  const [imageUrl, setImageUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const card = cardDetail?.card;
  const cardId = card?.id;

  const derivedShortCode = shortCodeFromPublicCode(publicCode.trim());
  const derivedSetId = setSlugFromShortCode(derivedShortCode);

  const canSubmit =
    cardId !== undefined &&
    derivedShortCode !== null &&
    derivedSetId !== null &&
    artist.trim().length > 0 &&
    publicCode.trim().length > 0 &&
    !createPrinting.isPending;

  function handleSubmit() {
    if (!canSubmit || !cardId) {
      return;
    }
    setErrorMsg(null);

    const printingFields: Record<string, unknown> = {
      shortCode: derivedShortCode,
      setId: derivedSetId,
      rarity,
      artVariant,
      isSigned,
      isOvernumbered,
      finish,
      size,
      artist: artist.trim(),
      publicCode: publicCode.trim(),
      language,
    };
    if (selectedMarkerSlugs.length > 0) {
      printingFields.markerSlugs = selectedMarkerSlugs;
    }
    if (selectedChannelSlugs.length > 0) {
      printingFields.distributionChannelSlugs = selectedChannelSlugs;
    }
    if (printedName.trim()) {
      printingFields.printedName = printedName.trim();
    }
    if (printedYear.trim()) {
      // oxlint-disable-next-line unicorn/prefer-number-coercion -- lenient parse of a form field; Number() would yield NaN on trailing text
      const parsed = Number.parseInt(printedYear.trim(), 10);
      if (Number.isFinite(parsed)) {
        printingFields.printedYear = parsed;
      }
    }
    if (printedRulesText.trim()) {
      printingFields.printedRulesText = printedRulesText.trim();
    }
    if (printedEffectText.trim()) {
      printingFields.printedEffectText = printedEffectText.trim();
    }
    if (flavorText.trim()) {
      printingFields.flavorText = flavorText.trim();
    }
    if (imageUrl.trim()) {
      printingFields.imageUrl = imageUrl.trim();
    }

    createPrinting.mutate(
      { cardId, cardSlug, printingFields: printingFields as CreatePrintingBody },
      {
        onSuccess: () => {
          void navigate({ to: "/admin/cards/$cardSlug", params: { cardSlug } });
        },
        onError: (error) => {
          setErrorMsg(errorText(error, "Failed to create printing"));
        },
      },
    );
  }

  const topBar = <AdminPageTopBar title={source ? "Duplicate printing" : "Create new printing"} />;

  if (isLoading) {
    return (
      <>
        {topBar}
        <p className="text-muted-foreground">Loading…</p>
      </>
    );
  }
  if (!card) {
    return (
      <>
        {topBar}
        <p className="text-muted-foreground">Card not found.</p>
      </>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      {topBar}
      {source && (
        <PageDescription>
          Duplicating <span className="font-medium">{source.expectedPrintingId}</span> for{" "}
          <span className="font-medium">{card.name}</span>. Update fields as needed.
        </PageDescription>
      )}

      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <Field>
            <FieldLabel htmlFor="create-printing-language">Language</FieldLabel>
            <SimpleSelect
              id="create-printing-language"
              items={languages.map((l) => ({ value: l.code, label: l.name, detail: l.code }))}
              value={language}
              onChange={setLanguage}
              className="w-full"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="create-printing-public-code">Public code *</FieldLabel>
            <Input
              id="create-printing-public-code"
              value={publicCode}
              onChange={(e) => setPublicCode(e.target.value)}
              placeholder="e.g. OGN-202/298"
              className="font-mono"
            />
            <FieldDescription>
              {derivedShortCode === null
                ? "The short code and the set are read off this."
                : `Saved as ${derivedShortCode} in ${derivedSetId ?? "no set"}.`}
            </FieldDescription>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="create-printing-rarity">Rarity</FieldLabel>
            <SimpleSelect
              id="create-printing-rarity"
              items={orders.rarities.map((slug) => ({
                value: slug,
                label: enumLabel(labels.rarities, slug),
              }))}
              value={rarity}
              onChange={setRarity}
              className="w-full"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="create-printing-art-variant">Art variant</FieldLabel>
            <SimpleSelect
              id="create-printing-art-variant"
              items={orders.artVariants.map((slug) => ({
                value: slug,
                label: enumLabel(labels.artVariants, slug),
              }))}
              value={artVariant}
              onChange={setArtVariant}
              className="w-full"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="create-printing-finish">Finish</FieldLabel>
            <SimpleSelect
              id="create-printing-finish"
              items={orders.finishes.map((slug) => ({
                value: slug,
                label: enumLabel(labels.finishes, slug),
              }))}
              value={finish}
              onChange={setFinish}
              className="w-full"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="create-printing-size">Size</FieldLabel>
            <SimpleSelect
              id="create-printing-size"
              items={orders.cardSizes.map((slug) => ({
                value: slug,
                label: enumLabel(labels.cardSizes, slug),
              }))}
              value={size}
              onChange={setSize}
              className="w-full"
            />
          </Field>
          <Field orientation="horizontal" className="sm:self-end">
            <Checkbox
              id="create-printing-signed"
              checked={isSigned}
              onCheckedChange={setIsSigned}
            />
            <FieldLabel htmlFor="create-printing-signed">Signed</FieldLabel>
          </Field>
          <Field orientation="horizontal" className="sm:self-end">
            <Checkbox
              id="create-printing-overnumbered"
              checked={isOvernumbered}
              onCheckedChange={setIsOvernumbered}
            />
            <FieldLabel htmlFor="create-printing-overnumbered">Overnumbered</FieldLabel>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="create-printing-markers">Markers</FieldLabel>
            <OrderedMultiSelect
              id="create-printing-markers"
              options={markers
                .map((m) => ({ value: m.slug, label: m.label }))
                .toSorted((a, b) => a.label.localeCompare(b.label))}
              selected={selectedMarkerSlugs}
              onChange={setSelectedMarkerSlugs}
              emptyOptionsText="No markers defined"
              placeholder="— select markers —"
              searchPlaceholder="Search markers…"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="create-printing-channels">Distribution channels</FieldLabel>
            <OrderedMultiSelect
              id="create-printing-channels"
              options={channelOptions}
              selected={selectedChannelSlugs}
              onChange={setSelectedChannelSlugs}
              emptyOptionsText="No channels defined"
              placeholder="— select channels —"
              searchPlaceholder="Search channels…"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="create-printing-artist">Artist *</FieldLabel>
            <Input
              id="create-printing-artist"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. Jane Doe"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="create-printing-printed-name">Printed name</FieldLabel>
            <Input
              id="create-printing-printed-name"
              value={printedName}
              onChange={(e) => setPrintedName(e.target.value)}
              placeholder="Leave blank to use card name"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="create-printing-printed-year">Printed year</FieldLabel>
            <Input
              id="create-printing-printed-year"
              value={printedYear}
              onChange={(e) => setPrintedYear(e.target.value)}
              placeholder="e.g. 2025"
              inputMode="numeric"
            />
          </Field>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
          <Field className="lg:sticky lg:top-20 lg:self-start">
            <FieldLabel htmlFor="create-printing-image">Reference image</FieldLabel>
            {imageUrl.trim() ? (
              <img
                src={imageUrl.trim()}
                alt="Card reference"
                className="max-h-[70vh] w-full rounded-md object-contain"
              />
            ) : (
              <div className="text-muted-foreground border-input flex h-48 items-center justify-center rounded-md border border-dashed px-3 text-center">
                Paste an image URL to preview the card while you type.
              </div>
            )}
            <Input
              id="create-printing-image"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Image URL — https://…"
            />
          </Field>
          <div className="space-y-4">
            <CardTextInput
              label="Printed rules text"
              value={printedRulesText}
              onChange={setPrintedRulesText}
              rows={3}
              reformat={reformatRules}
            />
            <CardTextInput
              label="Printed effect text"
              value={printedEffectText}
              onChange={setPrintedEffectText}
              rows={3}
              reformat={reformatRules}
            />
            <CardTextInput
              label="Flavor text"
              variant="flavor"
              value={flavorText}
              onChange={setFlavorText}
              rows={2}
              reformat={reformatFlavor}
            />
          </div>
        </div>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            <PlusIcon className="size-4" />
            Create printing
          </Button>
          <Button
            variant="ghost"
            onClick={() => void navigate({ to: "/admin/cards/$cardSlug", params: { cardSlug } })}
          >
            Cancel
          </Button>
        </div>
      </FieldGroup>
    </div>
  );
}

export function OrderedMultiSelect({
  id,
  options,
  selected,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyOptionsText,
}: {
  id: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyOptionsText: string;
}) {
  if (options.length === 0) {
    return <span className="text-muted-foreground text-sm">{emptyOptionsText}</span>;
  }
  const inOptionOrder = (values: readonly string[]) => {
    const chosen = new Set(values);
    return options.filter((option) => chosen.has(option.value)).map((option) => option.value);
  };
  return (
    <ComboboxPicker
      multiple
      id={id}
      options={options}
      value={inOptionOrder(selected)}
      onChange={(next) => onChange(inOptionOrder(next))}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText="No matches."
      contentClassName="w-72"
    />
  );
}

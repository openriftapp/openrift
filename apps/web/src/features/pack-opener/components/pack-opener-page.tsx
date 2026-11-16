import { BOOSTERS, boosterSlugForSet } from "@openrift/shared/boosters/definitions";
import { toBoosterPrintings } from "@openrift/shared/boosters/input";
import { resolveBooster } from "@openrift/shared/boosters/resolve";
import { openBoosterPacks } from "@openrift/shared/boosters/sample";
import type { ResolvedBooster } from "@openrift/shared/boosters/types";
import { clamp } from "@openrift/shared/math";
import { sideKey } from "@openrift/shared/printing-side";
import { mathRandom } from "@openrift/shared/random";
import type { SetListEntry } from "@openrift/shared/types/api/catalog";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { WellKnown } from "@openrift/shared/well-known";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PackagePlusIcon, SparklesIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { PageHero } from "@/components/layout/page-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Switch } from "@/components/ui/switch";
import { TextLink } from "@/components/ui/text-link";
import { usePrices } from "@/features/cards/hooks/use-prices";
import {
  publicSetDetailQueryOptions,
  publicSetListQueryOptions,
} from "@/features/cards/lib/public-sets-queries";
import { PackBulkGrid, PackHeading } from "@/features/pack-opener/components/pack-bulk-grid";
import { toPackResult } from "@/features/pack-opener/components/pack-opener-utils";
import { PackReveal } from "@/features/pack-opener/components/pack-reveal";
import { PackStats } from "@/features/pack-opener/components/pack-stats";
import type { PackResult } from "@/features/pack-opener/lib/pack-types";
import { useNumericDraft } from "@/hooks/use-numeric-draft";
import { useSession } from "@/hooks/use-session";
import { cn, PAGE_PADDING_NO_TOP } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

function useOpenableBoosters(setSlug: string): ResolvedBooster[] {
  const { data } = useSuspenseQuery(publicSetDetailQueryOptions(setSlug));
  const slug = boosterSlugForSet(setSlug);
  const definition = slug ? BOOSTERS[slug] : undefined;
  if (!slug || !definition) {
    return [];
  }
  const printings = toBoosterPrintings(data.printings);
  return Object.keys(definition.languages).flatMap((language) => {
    const resolved = resolveBooster(slug, language, printings);
    return resolved?.openable ? [resolved] : [];
  });
}

export function PackOpenerPage() {
  const { data: setList } = useSuspenseQuery(publicSetListQueryOptions);
  const mainSets = setList.sets.filter(
    (set) => set.setType === WellKnown.setType.MAIN && boosterSlugForSet(set.slug) !== undefined,
  );

  const [setSlug, setSetSlug] = useState<string>(() => mainSets[0]?.slug ?? "");
  const [language, setLanguage] = useState<string>(WellKnown.language.EN);
  const [countChoice, setCountChoice] = useState<string>("1");
  const [customCount, setCustomCount] = useState<number>(5);
  const [opening, setOpening] = useState<PackOpening>({ id: 0, packs: [] });
  const clearPacks = () => setOpening((current) => ({ id: current.id, packs: [] }));
  const [shimmer, setShimmer] = useState(true);
  const [autoReveal, setAutoReveal] = useState(false);

  const boosterSlug = boosterSlugForSet(setSlug);
  const packsPerBox =
    (boosterSlug ? BOOSTERS[boosterSlug]?.languages[language]?.packsPerBox : undefined) ?? 24;
  const count =
    countChoice === "custom"
      ? clamp(Math.floor(customCount || 1), 1, 500)
      : countChoice === "box"
        ? packsPerBox
        : 1;

  if (mainSets.length === 0) {
    return (
      <>
        <PackOpenerHero />
        <div className={cn(PAGE_PADDING_NO_TOP, "pt-3")}>
          <EmptyState
            className="py-12"
            icon={PackagePlusIcon}
            title={m.packs_empty_title()}
            description={m.packs_empty_description()}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PackOpenerHero lead={m.packs_hero_lead()}>
        <div className="mt-3 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <SetPickerField
            className="sm:col-span-2 md:col-span-1"
            sets={mainSets}
            value={setSlug}
            onChange={(slug) => {
              setSetSlug(slug);
              clearPacks();
            }}
          />
          <LanguageField
            setSlug={setSlug}
            value={language}
            onChange={(value) => {
              setLanguage(value);
              clearPacks();
            }}
          />
          <CountField
            packsPerBox={packsPerBox}
            choice={countChoice}
            custom={customCount}
            onChoiceChange={setCountChoice}
            onCustomChange={setCustomCount}
          />
          <div className="flex flex-col gap-2 sm:col-span-2 md:col-span-3 md:max-w-sm">
            <SwitchRow label={m.packs_toggle_shimmer()} checked={shimmer} onChange={setShimmer} />
            <SwitchRow
              label={m.packs_toggle_auto_reveal()}
              checked={autoReveal}
              onChange={setAutoReveal}
            />
          </div>
          <OpenAction
            setSlug={setSlug}
            language={language}
            count={count}
            onOpened={(packs) => setOpening((current) => ({ id: current.id + 1, packs }))}
          />
          {boosterSlug && (
            <p className="sm:col-span-2 md:col-span-3">
              <TextLink render={<Link to="/products/$slug" params={{ slug: boosterSlug }} />}>
                {m.packs_odds_link()}
              </TextLink>
            </p>
          )}
        </div>
      </PackOpenerHero>
      <div className={cn(PAGE_PADDING_NO_TOP, "flex flex-col gap-8 pt-3")}>
        <PackResults
          opening={opening}
          setSlug={setSlug}
          shimmer={shimmer}
          autoReveal={autoReveal}
        />
      </div>
    </>
  );
}

function PackOpenerHero({ lead, children }: { lead?: string; children?: ReactNode }) {
  return (
    <PageHero
      width="full"
      eyebrow={m.packs_hero_eyebrow()}
      title={m.packs_title()}
      lead={lead}
      compactTitle
    >
      {children}
    </PageHero>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <Label htmlFor={id}>{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SetPickerField({
  className,
  sets,
  value,
  onChange,
}: {
  className?: string;
  sets: SetListEntry[];
  value: string;
  onChange: (slug: string) => void;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label>{m.packs_field_set()}</Label>
      <SimpleSelect
        items={sets.map((s) => ({ value: s.slug, label: s.name }))}
        value={value}
        onChange={onChange}
        label={m.packs_field_set()}
        className="w-full"
      />
    </div>
  );
}

function LanguageField({
  setSlug,
  value,
  onChange,
}: {
  setSlug: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const languages = useOpenableBoosters(setSlug).map((booster) => booster.language);
  const effectiveValue = languages.includes(value)
    ? value
    : (languages[0] ?? WellKnown.language.EN);
  return (
    <div className="space-y-1">
      <Label>{m.packs_field_language()}</Label>
      <SimpleSelect
        items={languages.map((code) => ({ value: code, label: code }))}
        value={effectiveValue}
        onChange={onChange}
        label={m.packs_field_language()}
        className="w-full"
      />
    </div>
  );
}

function countOptions(packsPerBox: number) {
  return [
    { value: "1", label: m.packs_count_one() },
    { value: "box", label: m.packs_count_box({ count: packsPerBox }) },
    { value: "custom", label: m.packs_count_custom() },
  ] as const;
}

function CountField({
  packsPerBox,
  choice,
  custom,
  onChoiceChange,
  onCustomChange,
}: {
  packsPerBox: number;
  choice: string;
  custom: number;
  onChoiceChange: (value: string) => void;
  onCustomChange: (value: number) => void;
}) {
  const options = countOptions(packsPerBox);
  const { inputProps } = useNumericDraft({
    display: String(custom),
    onCommit: (text) => {
      // oxlint-disable-next-line unicorn/prefer-number-coercion -- lenient parse of an input value; Number() would yield NaN on trailing text
      const parsed = Number.parseInt(text, 10);
      if (!Number.isNaN(parsed)) {
        onCustomChange(parsed);
      }
    },
  });
  return (
    <div className="space-y-1">
      <Label>{m.packs_field_packs()}</Label>
      <div className="flex gap-2">
        <SimpleSelect
          items={options}
          value={choice}
          onChange={onChoiceChange}
          label={m.packs_field_packs()}
          className="flex-1"
        />
        {choice === "custom" && (
          <Input
            type="number"
            min={1}
            max={500}
            // Hides the native up/down spinner (Firefox via -moz-appearance, others via the webkit selectors).
            className="w-20 [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
            aria-label={m.packs_custom_count_aria()}
            {...inputProps}
          />
        )}
      </div>
    </div>
  );
}

function OpenAction({
  setSlug,
  language,
  count,
  onOpened,
}: {
  setSlug: string;
  language: string;
  count: number;
  onOpened: (packs: PackResult[]) => void;
}) {
  const boosters = useOpenableBoosters(setSlug);
  const booster = boosters.find((entry) => entry.language === language) ?? boosters[0];

  return (
    <div className="sm:col-span-2 md:col-span-3">
      <Button
        size="default"
        className="w-full md:w-auto"
        disabled={!booster}
        onClick={() => {
          if (booster) {
            onOpened(
              openBoosterPacks(booster, mathRandom, count).map((pack) => toPackResult(pack)),
            );
          }
        }}
      >
        <SparklesIcon className="size-4" />
        {booster ? m.packs_open({ count }) : m.packs_no_pool()}
      </Button>
    </div>
  );
}

export interface PackOpening {
  id: number;
  packs: PackResult[];
}

export function PackResults({
  opening,
  setSlug,
  shimmer,
  autoReveal,
}: {
  opening: PackOpening;
  setSlug: string;
  shimmer: boolean;
  autoReveal: boolean;
}) {
  const [first] = opening.packs;
  if (opening.packs.length === 1 && first) {
    return (
      <SinglePackResult
        key={opening.id}
        pack={first}
        setSlug={setSlug}
        shimmer={shimmer}
        autoReveal={autoReveal}
      />
    );
  }
  if (opening.packs.length > 1) {
    return (
      <BulkPackResult
        key={opening.id}
        packs={opening.packs}
        setSlug={setSlug}
        shimmer={shimmer}
        autoReveal={autoReveal}
      />
    );
  }
  return null;
}

function SinglePackResult({
  pack,
  setSlug,
  shimmer,
  autoReveal,
}: {
  pack: PackResult;
  setSlug: string;
  shimmer: boolean;
  autoReveal: boolean;
}) {
  const { data } = useSuspenseQuery(publicSetDetailQueryOptions(setSlug));
  const imagesByPrintingId = new Map(data.printings.map((p) => [sideKey(p), p.images] as const));
  const [statsVisible, setStatsVisible] = useState(autoReveal);
  // Reset during render, not an effect, so the gate is armed before this render paints.
  const [gateArmedFor, setGateArmedFor] = useState(autoReveal);
  if (gateArmedFor !== autoReveal) {
    setGateArmedFor(autoReveal);
    setStatsVisible(autoReveal);
  }
  return (
    <section className="space-y-6">
      <PackReveal
        pack={pack}
        imagesByPrintingId={imagesByPrintingId}
        onAllRevealed={() => setStatsVisible(true)}
        autoReveal={autoReveal}
        shimmer={shimmer}
      />
      {statsVisible && <ValueStats packs={[pack]} />}
    </section>
  );
}

function BulkPackResult({
  packs,
  setSlug,
  shimmer,
  autoReveal,
}: {
  packs: PackResult[];
  setSlug: string;
  shimmer: boolean;
  autoReveal: boolean;
}) {
  const { data } = useSuspenseQuery(publicSetDetailQueryOptions(setSlug));
  const imagesByPrintingId = new Map(data.printings.map((p) => [sideKey(p), p.images] as const));
  const [revealedCount, setRevealedCount] = useState(autoReveal ? packs.length : 0);
  // Reset during render, not an effect, so the gate is armed before this render paints.
  const [countArmedFor, setCountArmedFor] = useState(autoReveal);
  if (countArmedFor !== autoReveal) {
    setCountArmedFor(autoReveal);
    setRevealedCount(autoReveal ? packs.length : 0);
  }
  const statsVisible = revealedCount >= packs.length;

  if (autoReveal) {
    return (
      <section className="space-y-6">
        <ValueStats packs={packs} />
        <PackBulkGrid packs={packs} imagesByPrintingId={imagesByPrintingId} shimmer={shimmer} />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {packs.map((pack, i) => (
        <div key={i} className="flex flex-col gap-2">
          <PackHeading index={i + 1} count={pack.pulls.length} />
          <PackReveal
            pack={pack}
            imagesByPrintingId={imagesByPrintingId}
            shimmer={shimmer}
            onAllRevealed={() => setRevealedCount((n) => n + 1)}
          />
        </div>
      ))}
      {statsVisible && <ValueStats packs={packs} />}
    </section>
  );
}

function ValueStats({ packs }: { packs: PackResult[] }) {
  const prices = usePrices();
  const { data: session } = useSession();
  const marketplaceOrder = useDisplayStore((s) => s.marketplaceOrder);
  const isLoggedIn = Boolean(session?.user);
  const marketplace: Marketplace | null = isLoggedIn ? marketplaceOrder[0] : null;
  return <PackStats packs={packs} prices={prices} marketplace={marketplace} />;
}

import { BOOSTERS, cardsPerPack } from "@openrift/shared/boosters/definitions";
import { toBoosterPrintings } from "@openrift/shared/boosters/input";
import { resolveBooster, resolvedOutcomes } from "@openrift/shared/boosters/resolve";
import type { ResolvedBooster, ResolvedOutcome } from "@openrift/shared/boosters/types";
import { legendDisplayName } from "@openrift/shared/card-name";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { PageHero } from "@/components/layout/page-hero";
import { Callout } from "@/components/ui/callout";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { BoosterBasisBadge } from "@/features/boosters/components/booster-basis-badge";
import {
  boosterName,
  boosterOutcomeLabel,
  boosterSlotLabel,
  perPackLabel,
} from "@/features/boosters/lib/booster-labels";
import {
  publicSetDetailQueryOptions,
  publicSetListQueryOptions,
} from "@/features/cards/lib/public-sets-queries";
import { cardLanguageName } from "@/features/cards/lib/set-hero-copy";
import { useLanguageLabels } from "@/hooks/use-enums";
import { formatCount, formatPercent } from "@/lib/format";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function boosterPageLanguage(slug: string, requested: string | undefined): string {
  const languages = Object.keys(BOOSTERS[slug]?.languages ?? {});
  return requested && languages.includes(requested) ? requested : (languages[0] ?? "EN");
}

export function BoosterPage({
  slug,
  language,
  onLanguageChange,
}: {
  slug: string;
  language: string;
  onLanguageChange: (language: string) => void;
}) {
  const definition = BOOSTERS[slug];
  const setSlug = definition?.set ?? "";
  const { data: setList } = useSuspenseQuery(publicSetListQueryOptions);
  const { data: setDetail } = useSuspenseQuery(publicSetDetailQueryOptions(setSlug));
  const languageLabels = useLanguageLabels();
  const languageEntry = definition?.languages[language];
  const set = setList.sets.find((entry) => entry.slug === setSlug);
  const booster = resolveBooster(slug, language, toBoosterPrintings(setDetail.printings));
  if (!definition || !languageEntry || !booster) {
    return null;
  }
  const name = boosterName(set?.name ?? setSlug);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHero
        eyebrow={m.booster_page_eyebrow()}
        title={name}
        lead={m.booster_page_lead({
          cards: formatCount(cardsPerPack(definition)),
          packs: formatCount(languageEntry.packsPerBox),
          boxes: formatCount(languageEntry.boxesPerCase),
        })}
      >
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div className="min-w-48 space-y-1">
            <Label>{m.booster_page_language()}</Label>
            <SimpleSelect
              items={Object.keys(definition.languages).map((code) => ({
                value: code,
                label: cardLanguageName(code, languageLabels),
              }))}
              value={language}
              onChange={onLanguageChange}
              label={m.booster_page_language()}
              className="w-full"
            />
          </div>
          <div className="flex h-(--control-h) items-center">
            <TextLink render={<Link to="/pack-opener" />}>{m.booster_page_open_link()}</TextLink>
          </div>
        </div>
      </PageHero>
      <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-6 pt-3 pb-6")}>
        {booster.openable ? (
          <>
            <section className="flex flex-col gap-3">
              <Heading>{m.booster_page_slots_heading()}</Heading>
              <p className="text-muted-foreground">
                {m.booster_page_note()} {m.booster_page_assumption()}
              </p>
              <BoosterSlotTable booster={booster} />
            </section>
            <BoosterPools booster={booster} />
          </>
        ) : (
          <Callout>{m.booster_page_cannot_open()}</Callout>
        )}
      </div>
    </div>
  );
}

function rateLabel(outcome: ResolvedOutcome): string {
  if (outcome.pool.length === 0 && !outcome.fillsRest) {
    return m.booster_page_not_available();
  }
  return perPackLabel(outcome.perPack, outcome.bound);
}

export function BoosterSlotTable({ booster }: { booster: ResolvedBooster }) {
  const rows = booster.slots.flatMap((slot) =>
    slot.outcomes.map((outcome, index) => ({
      key: `${slot.slug}-${outcome.slug}`,
      slotLabel:
        index === 0
          ? m.booster_page_slot_count({
              slot: boosterSlotLabel(slot.slug),
              count: formatCount(slot.count),
            })
          : "",
      share: formatPercent(outcome.perPack / slot.count),
      outcome,
    })),
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{m.booster_page_col_slot()}</TableHead>
          <TableHead>{m.booster_page_col_outcome()}</TableHead>
          <TableHead className="text-right">{m.booster_page_col_pool()}</TableHead>
          <TableHead className="text-right">{m.booster_page_col_share()}</TableHead>
          <TableHead>{m.booster_page_col_rate()}</TableHead>
          <TableHead>{m.booster_page_col_basis()}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ key, slotLabel, share, outcome }) => (
          <TableRow key={key}>
            <TableCell className="text-muted-foreground">{slotLabel}</TableCell>
            <TableCell>{boosterOutcomeLabel(outcome.slug)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCount(outcome.pool.length)}
            </TableCell>
            <TableCell className="text-right tabular-nums">{share}</TableCell>
            <TableCell className="tabular-nums">{rateLabel(outcome)}</TableCell>
            <TableCell>
              <BoosterBasisBadge basis={outcome.basis} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BoosterPools({ booster }: { booster: ResolvedBooster }) {
  const outcomes = resolvedOutcomes(booster).filter((outcome) => outcome.pool.length > 0);
  return (
    <section className="flex flex-col gap-3">
      <Heading>{m.booster_page_pools_heading()}</Heading>
      <ul className="flex flex-col gap-2">
        {outcomes.map((outcome) => (
          <BoosterPoolItem key={`${outcome.slot}-${outcome.slug}`} outcome={outcome} />
        ))}
      </ul>
    </section>
  );
}

function BoosterPoolItem({ outcome }: { outcome: ResolvedOutcome }) {
  const [expanded, setExpanded] = useState(false);
  const printings = outcome.pool.toSorted((a, b) => a.shortCode.localeCompare(b.shortCode));
  return (
    <li>
      <ExpandToggle expanded={expanded} onClick={() => setExpanded((value) => !value)}>
        <span className="font-medium">
          {boosterSlotLabel(outcome.slot)} › {boosterOutcomeLabel(outcome.slug)}
        </span>
        <span className="text-muted-foreground ml-2 tabular-nums">
          {formatCount(outcome.pool.length)}
        </span>
      </ExpandToggle>
      {expanded && (
        <ul className="mt-2 grid gap-x-4 gap-y-1 pl-6 sm:grid-cols-2 lg:grid-cols-3">
          {printings.map(({ printingId, printing }) => (
            <li key={printingId} className="min-w-0 truncate">
              <Link
                to="/cards/$cardSlug/{-$printingSlug}"
                params={{ cardSlug: printing.card.slug }}
                search={{ printingId }}
                className="hover:text-foreground"
              >
                <span className="text-muted-foreground mr-2 tabular-nums">
                  {printing.shortCode}
                </span>
                {legendDisplayName(printing.card)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

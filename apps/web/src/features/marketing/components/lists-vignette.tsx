import { enumLabel } from "@openrift/shared/enum-label";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  HeartIcon,
  SparklesIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react";
import type { ReactNode } from "react";

import { CountPill } from "@/components/ui/count-pill";
import { RuleSourceBadge } from "@/features/lists/components/rule-source-badge";
import { FIXTURE_CARDS, FIXTURE_LABELS } from "@/features/marketing/lib/vignette-fixtures";
import { ruleCountLabel, ruleWording } from "@/features/rules/lib/rule-wording";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { FAKE_CONTROL, StripGlyph, Swap, Vignette } from "./vignette-parts";

const WISHLIST_ROWS = [
  { name: FIXTURE_CARDS.hiddenBlade.name, rule: 2 },
  { name: FIXTURE_CARDS.legionRearguard.name, rule: 3 },
  { name: FIXTURE_CARDS.solariShieldbearer.name, rule: 3 },
] as const;

const RULE_CONTROL = cn(FAKE_CONTROL, "justify-between gap-1.5 pr-2 text-sm whitespace-nowrap");

function RuleControl({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn(RULE_CONTROL, "w-44", className)}>
      <span className="truncate">{children}</span>
      <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
    </span>
  );
}

function RuleRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </span>
  );
}

// Matches the geometry Switch renders: h-[18.4px] w-8, size-4 thumb.
function RuleSwitch() {
  return (
    <span className="bg-primary inline-flex h-[18.4px] w-8 shrink-0 items-center rounded-full border border-transparent">
      <span className="bg-background dark:bg-primary-foreground block size-4 translate-x-[calc(100%-2px)] rounded-full" />
    </span>
  );
}

function QuantityControl({ mode, amount }: { mode: string; amount: string }) {
  return (
    <span className="flex items-center gap-2">
      <RuleControl className="w-36">{mode}</RuleControl>
      <span className={cn(RULE_CONTROL, "w-20 tabular-nums")}>{amount}</span>
    </span>
  );
}

function ListsCount({ was, now }: { was: string; now: string }) {
  return (
    <Swap
      className="tabular-nums"
      was={was}
      now={now}
      wasAnimation="motion-safe:animate-lists-count-was"
      nowAnimation="motion-safe:animate-lists-count-now"
    />
  );
}

function missingCount(count: number): string {
  return ruleCountLabel(count, "card", ruleWording("wish", "card"), true);
}

function RuleBlock({
  title,
  count,
  children,
}: {
  title: string;
  count: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <span className="flex items-center justify-between">
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-muted-foreground text-xs">{count}</span>
        </span>
        <StripGlyph>
          <Trash2Icon className="size-4" />
        </StripGlyph>
      </span>
      {children}
    </div>
  );
}

export function ListsVignette() {
  return (
    <Vignette>
      <div className="flex flex-col gap-1">
        <span className="font-heading font-medium">{m.lists_rule_dialog_title()}</span>
        <p className="text-muted-foreground text-sm">{m.lists_rule_wording_wish_description()}</p>
      </div>
      <RuleBlock
        title={m.lists_rule_block_title({ number: 1 })}
        count={<ListsCount was={missingCount(214)} now={missingCount(213)} />}
      >
        <RuleRow label={m.lists_rule_dim_sets()}>
          <RuleControl>{enumLabel(FIXTURE_LABELS.sets, "OGN")}</RuleControl>
        </RuleRow>
        <RuleRow label={m.lists_rule_dim_languages()}>
          <RuleControl>{enumLabel(FIXTURE_LABELS.languages, "EN")}</RuleControl>
        </RuleRow>
        <RuleRow label={m.lists_rule_dim_finishes()}>
          <RuleControl>&minus;{enumLabel(FIXTURE_LABELS.finishes, "metal")}</RuleControl>
        </RuleRow>
        <RuleRow label={m.lists_rule_wording_wish_quantity_label()}>
          <QuantityControl mode={m.lists_rule_quantity_playset()} amount="1" />
        </RuleRow>
        <RuleRow label={m.lists_rule_net_owned_label()}>
          <RuleSwitch />
        </RuleRow>
      </RuleBlock>
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{m.marketing_lists_playset_gaps()}</span>
          <span title={m.collections_sidebar_rule_title()} className="flex shrink-0 items-center">
            <SparklesIcon className="text-primary size-3.5" aria-hidden="true" />
            <span className="sr-only">{m.collections_sidebar_dynamic_list()}</span>
          </span>
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            <HeartIcon className="size-3.5" aria-hidden="true" />
            {m.lists_intent_label_wish()}
          </span>
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            <SquareIcon className="size-3.5" aria-hidden="true" />
            <ListsCount
              was={m.marketing_lists_card_count({ count: 214 })}
              now={m.marketing_lists_card_count({ count: 213 })}
            />
          </span>
        </div>
        <ul className="flex flex-col text-sm">
          <li className="motion-safe:animate-lists-row relative h-0 overflow-hidden opacity-0">
            <span
              aria-hidden="true"
              className="motion-safe:animate-lists-land bg-primary/10 ring-primary/60 pointer-events-none absolute inset-x-0 inset-y-[1px] rounded-md opacity-0 ring-2 ring-inset"
            />
            <span className="relative flex items-center gap-2 py-[3px]">
              <span className="min-w-0 flex-1 truncate">{FIXTURE_CARDS.playfulPhantom.name}</span>
              <Swap
                className="justify-items-end"
                wasAnimation="motion-safe:animate-lists-owned-was"
                nowAnimation="motion-safe:animate-lists-owned-now"
                was={<RuleSourceBadge quantity={1} />}
                now={
                  <CountPill variant="success">
                    <CheckCircle2Icon className="size-3" aria-hidden="true" />
                    {m.cards_filter_owned_full()}
                  </CountPill>
                }
              />
            </span>
          </li>
          {WISHLIST_ROWS.map((row) => (
            <li key={row.name} className="flex items-center gap-2 py-[3px]">
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              <RuleSourceBadge quantity={row.rule} />
            </li>
          ))}
        </ul>
        <span className="text-muted-foreground text-xs">
          {m.decks_overview_zone_more({ count: 210 })}
        </span>
      </div>
    </Vignette>
  );
}

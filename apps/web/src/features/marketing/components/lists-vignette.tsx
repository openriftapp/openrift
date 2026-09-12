import {
  CheckCircle2Icon,
  ChevronDownIcon,
  HeartIcon,
  SparklesIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { CountPill } from "@/components/ui/count-pill";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { StripGlyph, Vignette } from "./vignette-parts";

const WISHLIST_ROWS = [
  { name: "Hidden Blade", rule: "2" },
  { name: "Legion Rearguard", rule: "3" },
] as const;

function RuleSourceBadge({ children }: { children: ReactNode }) {
  return (
    <Badge
      variant="subtle"
      className="rounded-md border-0 bg-transparent"
      title={m.lists_rule_badge_title()}
    >
      <SparklesIcon aria-hidden="true" />
      {children}
    </Badge>
  );
}

const RULE_CONTROL =
  "border-input dark:bg-input/30 flex h-8 items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap";

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
    <span className="inline-grid justify-items-start tabular-nums">
      <span className="motion-safe:animate-lists-count-was col-start-1 row-start-1 opacity-0">
        {was}
      </span>
      <span className="motion-safe:animate-lists-count-now col-start-1 row-start-1">{now}</span>
    </span>
  );
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
        count={
          <ListsCount
            was={m.marketing_lists_missing_cards({ count: 214 })}
            now={m.marketing_lists_missing_cards({ count: 213 })}
          />
        }
      >
        <RuleRow label={m.lists_rule_dim_sets()}>
          <RuleControl>Origins</RuleControl>
        </RuleRow>
        <RuleRow label={m.lists_rule_dim_languages()}>
          <RuleControl>English</RuleControl>
        </RuleRow>
        <RuleRow label={m.lists_rule_dim_finishes()}>
          <RuleControl>&minus;Metal</RuleControl>
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
              <span className="min-w-0 flex-1 truncate">Playful Phantom</span>
              <span className="inline-grid justify-items-end">
                <span className="motion-safe:animate-lists-owned-was col-start-1 row-start-1 opacity-0">
                  <RuleSourceBadge>
                    <span className="tabular-nums">1</span>
                  </RuleSourceBadge>
                </span>
                <span className="motion-safe:animate-lists-owned-now col-start-1 row-start-1">
                  <CountPill variant="success">
                    <CheckCircle2Icon className="size-3" aria-hidden="true" />
                    {m.cards_filter_owned_full()}
                  </CountPill>
                </span>
              </span>
            </span>
          </li>
          {WISHLIST_ROWS.map((row) => (
            <li key={row.name} className="flex items-center gap-2 py-[3px]">
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              <RuleSourceBadge>{row.rule}</RuleSourceBadge>
            </li>
          ))}
          <li className="flex items-center gap-2 py-[3px]">
            <span className="min-w-0 flex-1 truncate">Solari Shieldbearer</span>
            <RuleSourceBadge>3</RuleSourceBadge>
          </li>
        </ul>
        <span className="text-muted-foreground text-xs">
          {m.decks_overview_zone_more({ count: 210 })}
        </span>
      </div>
    </Vignette>
  );
}

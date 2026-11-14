import { ChevronRightIcon, SearchIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { FAKE_CONTROL, Vignette } from "./vignette-parts";

const QUERY = "deck";
const RULE_COUNT = 1443;

const GUIDES = {
  0: "",
  1: "rule-guides [--rule-depth:1]",
  2: "rule-guides [--rule-depth:2]",
} as const;

function Term({ children }: { children: ReactNode }) {
  return <em className="text-primary">{children}</em>;
}

function RuleRef({ children }: { children: ReactNode }) {
  return <span className="text-primary">{children}</span>;
}

function RuleRow({
  number,
  depth,
  children,
  toggle,
}: {
  number: string;
  depth: 0 | 1 | 2;
  children: ReactNode;
  toggle?: boolean;
}) {
  return (
    <div className="flex items-baseline py-2 text-sm">
      <span className="text-muted-foreground mr-3 shrink-0 font-mono text-xs">{number}</span>
      <span className={cn("min-w-0 flex-1", GUIDES[depth])}>
        {toggle && (
          <span className="motion-safe:animate-rules-before float-right ml-3 flex size-4 shrink-0 items-center justify-center opacity-0">
            <ChevronRightIcon className="text-muted-foreground size-3 rotate-90" />
          </span>
        )}
        {children}
      </span>
    </div>
  );
}

function FilteredRow({ children }: { children: ReactNode }) {
  return (
    <div className="motion-safe:animate-rules-collapse grid grid-rows-[0fr] opacity-0">
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

export function RulesVignette() {
  return (
    <Vignette>
      <div className={cn(FAKE_CONTROL, "gap-2")}>
        <SearchIcon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        <span className="relative min-w-0 flex-1">
          <span className="text-muted-foreground motion-safe:animate-rules-placeholder block truncate opacity-0">
            {m.rules_search_placeholder_count({ count: formatCount(RULE_COUNT) })}
          </span>
          <span className="motion-safe:animate-rules-type absolute inset-y-0 left-0 flex items-center whitespace-nowrap">
            {QUERY}
          </span>
        </span>
        <span className="text-muted-foreground motion-safe:animate-rules-after shrink-0 text-xs">
          {m.rules_count_filtered({ matched: 2, count: RULE_COUNT })}
        </span>
        <span
          aria-hidden="true"
          className="text-muted-foreground motion-safe:animate-rules-after shrink-0"
        >
          <XIcon className="size-3.5" />
        </span>
      </div>

      <div className="flex flex-col">
        <FilteredRow>
          <RuleRow number="113" depth={0}>
            Each player sets aside their <Term>Battlefields.</Term>
          </RuleRow>
        </FilteredRow>
        <RuleRow number="114" depth={0} toggle>
          Each player shuffles their <Term>Main</Term> and <Term>Rune Decks</Term>, separately, then
          places them into their respective Zones.
        </RuleRow>
        <RuleRow number="114.1" depth={1}>
          The <Term>Main Deck</Term> is placed in the <Term>Main Deck Zone.</Term>
        </RuleRow>
        <FilteredRow>
          <RuleRow number="107.1.b" depth={2}>
            Each Base is a <Term>Location.</Term>{" "}
            <em className="text-muted-foreground">
              See <RuleRef>rule 197</RuleRef>. Locations for more information.
            </em>
          </RuleRow>
        </FilteredRow>
      </div>
    </Vignette>
  );
}

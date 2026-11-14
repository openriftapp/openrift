import { enumLabel } from "@openrift/shared/enum-label";
import { Link } from "@tanstack/react-router";
import { SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { CardIcon } from "@/components/card-icon";
import { MiniCardArt } from "@/components/mini-card-art";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CardCountStrip } from "@/features/cards/components/card-count-strip";
import type { LandingThumbnailCard } from "@/features/marketing/lib/landing-thumbnails";
import { FIXTURE_LABELS } from "@/features/marketing/lib/vignette-fixtures";
import { getFilterIconPath } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { FAKE_CONTROL, Vignette } from "./vignette-parts";

const DOMAINS = [
  { slug: "fury", share: 0.169 },
  { slug: "calm", share: 0.17 },
  { slug: "mind", share: 0.169 },
  { slug: "body", share: 0.172 },
  { slug: "chaos", share: 0.168 },
  { slug: "order", share: 0.174 },
] as const;

const RARITIES = [
  { slug: "common", share: 0.291 },
  { slug: "uncommon", share: 0.279 },
  { slug: "rare", share: 0.274 },
  { slug: "epic", share: 0.161 },
  { slug: "showcase", share: 0.202 },
] as const;

type CatalogFilter = { axis: "rarity" | "domain"; slug: string } | null;

function matches(thumb: LandingThumbnailCard, filter: CatalogFilter): boolean {
  if (filter === null) {
    return true;
  }
  if (filter.axis === "rarity") {
    return thumb.rarity === filter.slug;
  }
  return thumb.domains.includes(filter.slug);
}

export function CatalogVignette({
  cards,
  cardCount,
}: {
  cards: LandingThumbnailCard[];
  cardCount?: number;
}) {
  const [filter, setFilter] = useState<CatalogFilter>(null);
  const active =
    filter === null
      ? undefined
      : filter.axis === "rarity"
        ? RARITIES.find((entry) => entry.slug === filter.slug)
        : DOMAINS.find((entry) => entry.slug === filter.slug);
  const activeLabel =
    filter === null
      ? undefined
      : enumLabel(
          filter.axis === "rarity" ? FIXTURE_LABELS.rarities : FIXTURE_LABELS.domains,
          filter.slug,
        );
  const shown = cards.filter((thumb) => matches(thumb, filter)).slice(0, 8);
  // The sample is client-only; disabling chips before it arrives would flip
  // the `disabled` attribute on hydration and mismatch.
  const hasSample = cards.length > 0;
  const filtered = active && cardCount ? Math.round(cardCount * active.share) : undefined;
  const total = cardCount === undefined ? undefined : m.common_cards({ count: cardCount });
  const placeholder =
    total !== undefined && filtered === undefined
      ? m.cards_browser_search_placeholder_count({ items: total })
      : m.cards_browser_search_placeholder();
  const count =
    total !== undefined && filtered !== undefined ? `${filtered} / ${total}` : undefined;
  const search =
    filter === null
      ? {}
      : filter.axis === "rarity"
        ? { rarities: [filter.slug] }
        : { domains: [filter.slug] };

  return (
    <Vignette>
      <Link
        to="/cards"
        search={search}
        aria-label={
          activeLabel
            ? m.marketing_catalog_browse_facet({ label: activeLabel })
            : m.marketing_catalog_browse_all()
        }
        className={cn(
          FAKE_CONTROL,
          "hover:bg-muted focus-visible:ring-ring gap-2 transition-colors focus-visible:ring-2 focus-visible:outline-none",
        )}
      >
        <SearchIcon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        <span className="text-muted-foreground flex-1 truncate">{placeholder}</span>
        {count && <span className="text-muted-foreground text-xs font-normal">{count}</span>}
      </Link>

      <div className="flex flex-wrap items-center gap-1.5">
        <ToggleGroup
          multiple
          variant="outline"
          size="sm"
          spacing={0}
          aria-label={m.marketing_catalog_domain_filter()}
          value={filter?.axis === "domain" ? [filter.slug] : []}
          onValueChange={(next) => {
            const slug = (next as string[]).at(-1);
            setFilter(slug === undefined ? null : { axis: "domain", slug });
          }}
        >
          {DOMAINS.map((entry) => {
            const icon = getFilterIconPath("domains", entry.slug);
            return (
              <ToggleGroupItem
                key={entry.slug}
                value={entry.slug}
                aria-label={enumLabel(FIXTURE_LABELS.domains, entry.slug)}
                disabled={hasSample && !cards.some((thumb) => thumb.domains.includes(entry.slug))}
              >
                {icon && <CardIcon src={icon} className="size-4" />}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
        <ToggleGroup
          multiple
          variant="outline"
          size="sm"
          spacing={0}
          aria-label={m.marketing_catalog_rarity_filter()}
          value={filter?.axis === "rarity" ? [filter.slug] : []}
          onValueChange={(next) => {
            const slug = (next as string[]).at(-1);
            setFilter(slug === undefined ? null : { axis: "rarity", slug });
          }}
        >
          {RARITIES.map((entry) => {
            const icon = getFilterIconPath("rarities", entry.slug);
            return (
              <ToggleGroupItem
                key={entry.slug}
                value={entry.slug}
                aria-label={enumLabel(FIXTURE_LABELS.rarities, entry.slug)}
                disabled={hasSample && !cards.some((thumb) => thumb.rarity === entry.slug)}
              >
                {icon && <CardIcon src={icon} className="size-4" />}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
        {filter !== null && (
          <Button
            variant="ghost"
            size="icon-sm"
            title={m.cards_clear_all_filters()}
            aria-label={m.cards_clear_all_filters()}
            className="ml-auto"
            onClick={() => setFilter(null)}
          >
            <XIcon />
          </Button>
        )}
      </div>

      <div
        key={filter === null ? "all" : `${filter.axis}:${filter.slug}`}
        className="motion-safe:animate-in motion-safe:fade-in-0 grid grid-cols-4 gap-2 duration-300"
      >
        {shown.map(({ url }) => (
          <div key={url} className="flex flex-col">
            <CardCountStrip count={0} />
            <div className="group rounded-lg p-0.75">
              <MiniCardArt url={url} className="hover:ring-primary/60 hover:ring-2" />
            </div>
          </div>
        ))}
      </div>
    </Vignette>
  );
}

import { Link } from "@tanstack/react-router";
import { CoinsIcon, CopyIcon, ImageOffIcon, SquareIcon, SquareStackIcon } from "lucide-react";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { MarketplaceLink } from "@/components/marketplace-link";
import { TextLink } from "@/components/ui/text-link";
import { MARKETPLACE_META } from "@/features/cards/lib/marketplace-meta";
import type { CollectionStats } from "@/features/collections/hooks/use-collection-stats";
import { useMyMissingImages } from "@/features/contribute/hooks/use-missing-images";
import { formatCount } from "@/lib/format";
import { m } from "@/paraglide/messages.js";

function HeroStat({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div data-slot="hero-stat" className="flex min-w-36 flex-col gap-0.5">
      <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
        <Icon className="size-4" />
        {label}
      </span>
      <span
        data-slot="hero-stat-value"
        className="font-heading text-3xl font-semibold tabular-nums"
      >
        {value}
      </span>
      {children}
    </div>
  );
}

export function StatsHeroStats({ stats }: { stats: CollectionStats }) {
  const marketplace = MARKETPLACE_META[stats.marketplace];
  const { data: missingImages } = useMyMissingImages();
  const missingImageCount = missingImages?.items.length ?? 0;
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-5">
      <HeroStat
        icon={SquareIcon}
        label={m.collections_stats_hero_unique_cards()}
        value={formatCount(stats.uniqueCards)}
      />
      <HeroStat
        icon={CopyIcon}
        label={m.collections_stats_hero_unique_printings()}
        value={formatCount(stats.uniquePrintings)}
      />
      <HeroStat
        icon={SquareStackIcon}
        label={m.collections_stats_hero_total_copies()}
        value={formatCount(stats.totalCopies)}
      />
      <HeroStat
        icon={CoinsIcon}
        label={m.collections_stats_hero_estimated_value()}
        value={
          <TextLink
            variant="inherit"
            className="text-foreground no-underline"
            render={
              <MarketplaceLink
                marketplace={stats.marketplace}
                href={marketplace.searchUrl("riftbound")}
              />
            }
          >
            {stats.formatPrice(stats.estimatedValue)}
          </TextLink>
        }
      >
        <span className="text-muted-foreground text-xs">
          <span className="flex items-center gap-1">
            <img src={marketplace.icon} alt="" className="h-3 invert dark:invert-0" />
            {marketplace.label}
          </span>
          {stats.unpricedCount > 0 && (
            <span className="block">
              {m.collections_stats_hero_unpriced({ count: stats.unpricedCount })}
            </span>
          )}
        </span>
      </HeroStat>
      {missingImageCount > 0 && (
        <HeroStat
          icon={ImageOffIcon}
          label={m.collections_stats_hero_missing_images()}
          value={
            <TextLink
              variant="inherit"
              className="text-foreground no-underline"
              render={<Link to="/contribute" />}
            >
              {formatCount(missingImageCount)}
            </TextLink>
          }
        >
          <span className="text-muted-foreground text-xs">
            {m.collections_stats_hero_missing_images_hint()}
          </span>
        </HeroStat>
      )}
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { CoinsIcon, CopyIcon, ImageOffIcon, SquareIcon, SquareStackIcon } from "lucide-react";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { MarketplaceLink } from "@/components/marketplace-link";
import { TextLink } from "@/components/ui/text-link";
import { MARKETPLACE_META } from "@/features/cards/lib/marketplace-meta";
import type { CollectionStats } from "@/features/collections/hooks/use-collection-stats";
import { useMyMissingImages } from "@/features/contribute/hooks/use-missing-images";
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
    <div className="flex min-w-36 flex-col gap-0.5">
      <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
        <Icon className="size-4" />
        {label}
      </span>
      <span className="font-heading text-3xl font-semibold tabular-nums">{value}</span>
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
        value={stats.uniqueCards.toLocaleString()}
      />
      <HeroStat
        icon={CopyIcon}
        label={m.collections_stats_hero_unique_printings()}
        value={stats.uniquePrintings.toLocaleString()}
      />
      <HeroStat
        icon={SquareStackIcon}
        label={m.collections_stats_hero_total_copies()}
        value={stats.totalCopies.toLocaleString()}
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
              {stats.unpricedCount === 1
                ? m.collections_stats_hero_unpriced_one({ count: stats.unpricedCount })
                : m.collections_stats_hero_unpriced_other({ count: stats.unpricedCount })}
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
              {missingImageCount.toLocaleString()}
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

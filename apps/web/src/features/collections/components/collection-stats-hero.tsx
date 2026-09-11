import { CoinsIcon, CopyIcon, SquareIcon, SquareStackIcon } from "lucide-react";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { MarketplaceLink } from "@/components/marketplace-link";
import { MARKETPLACE_META } from "@/features/cards/lib/marketplace-meta";
import { CollectionMissingImagesTile } from "@/features/collections/components/collection-missing-images-tile";
import type { CollectionStats } from "@/features/collections/hooks/use-collection-stats";

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
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-x-10 gap-y-5">
        <HeroStat
          icon={SquareIcon}
          label="Unique Cards"
          value={stats.uniqueCards.toLocaleString()}
        />
        <HeroStat
          icon={CopyIcon}
          label="Unique Printings"
          value={stats.uniquePrintings.toLocaleString()}
        />
        <HeroStat
          icon={SquareStackIcon}
          label="Total Copies"
          value={stats.totalCopies.toLocaleString()}
        />
        <HeroStat
          icon={CoinsIcon}
          label="Estimated Value"
          value={
            <MarketplaceLink
              marketplace={stats.marketplace}
              href={marketplace.searchUrl("riftbound")}
              className="text-foreground no-underline hover:underline"
            >
              {stats.formatPrice(stats.estimatedValue)}
            </MarketplaceLink>
          }
        >
          <span className="text-muted-foreground text-xs">
            <span className="flex items-center gap-1">
              <img src={marketplace.icon} alt="" className="h-3 invert dark:invert-0" />
              {marketplace.label}
            </span>
            {stats.unpricedCount > 0 && (
              <span className="block">
                {stats.unpricedCount} {stats.unpricedCount === 1 ? "copy" : "copies"} unpriced
              </span>
            )}
          </span>
        </HeroStat>
      </div>
      <div className="sm:max-w-xs">
        <CollectionMissingImagesTile />
      </div>
    </div>
  );
}

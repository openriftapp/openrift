import { Link } from "@tanstack/react-router";

import { Heading } from "@/components/heading";
import { Reveal } from "@/features/marketing/components/reveal";
import { ScanVignette } from "@/features/marketing/components/scan-vignette";
import type { LandingThumbnailCard } from "@/features/marketing/lib/landing-thumbnails";
import { marketplaceNames } from "@/features/marketing/lib/marketplace-copy";
import { useFeatureEnabled } from "@/hooks/use-feature-flags";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { ActionArrow, FEATURE_ACTION_CLASS, SectionRule } from "./feature-section";
import { GroupsVignette } from "./groups-vignette";
import { ListsVignette } from "./lists-vignette";
import { PricesVignette } from "./prices-vignette";

export function FeatureShowcase({
  scanCards,
  thumbnailUrls,
}: {
  scanCards: LandingThumbnailCard[];
  thumbnailUrls: string[];
}) {
  const scannerEnabled = useFeatureEnabled("scanner");
  const features = [
    ...(scannerEnabled
      ? [
          {
            title: m.marketing_showcase_scan_title(),
            description: m.marketing_showcase_scan_description(),
            cta: m.marketing_showcase_scan_cta(),
            to: "/scan",
            vignette: <ScanVignette cards={scanCards} />,
          },
        ]
      : []),
    {
      title: m.marketing_showcase_collection_title(),
      description: m.marketing_showcase_collection_description(),
      cta: m.marketing_showcase_collection_cta(),
      to: "/collections",
      vignette: <ListsVignette />,
    },
    {
      title: m.marketing_showcase_groups_title(),
      description: m.marketing_showcase_groups_description(),
      cta: m.marketing_showcase_groups_cta(),
      to: "/groups",
      vignette: <GroupsVignette thumbnailUrls={thumbnailUrls} />,
    },
    {
      title: m.marketing_showcase_prices_title(),
      description: m.marketing_showcase_prices_description({ marketplaces: marketplaceNames() }),
      cta: m.marketing_showcase_prices_cta(),
      to: "/cards",
      vignette: <PricesVignette />,
    },
  ] as const;

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-16 md:gap-24 md:py-24">
      {features.map((feature, index) => (
        <Reveal key={feature.title}>
          <div className="hover:bg-background/60 has-focus-visible:ring-ring relative grid grid-cols-1 items-center gap-8 rounded-2xl p-4 transition-colors has-focus-visible:ring-2 sm:p-6 lg:grid-cols-2 lg:gap-14">
            <div className={cn("flex flex-col gap-4", index % 2 === 1 && "lg:order-2")}>
              <Heading level={1} as="h2">
                {feature.title}
              </Heading>
              <SectionRule />
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              <Link
                to={feature.to}
                className={cn(
                  FEATURE_ACTION_CLASS,
                  "text-primary after:absolute after:inset-0 after:z-10 after:rounded-2xl focus-visible:ring-0",
                )}
              >
                {feature.cta}
                <ActionArrow />
              </Link>
            </div>
            <div className={cn("isolate", index % 2 === 1 && "lg:order-1")}>{feature.vignette}</div>
          </div>
        </Reveal>
      ))}
    </section>
  );
}

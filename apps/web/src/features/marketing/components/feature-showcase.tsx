import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";

import { Heading } from "@/components/heading";
import { OrnamentRule } from "@/components/ui/ornament";
import { Reveal } from "@/features/marketing/components/reveal";
import { ScanVignette } from "@/features/marketing/components/scan-vignette";
import type { LandingThumbnailCard } from "@/features/marketing/lib/landing-thumbnails";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

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
  const features = [
    {
      title: m.marketing_showcase_scan_title(),
      description: m.marketing_showcase_scan_description(),
      cta: m.marketing_showcase_scan_cta(),
      to: "/scan",
      vignette: <ScanVignette cards={scanCards} />,
    },
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
      description: m.marketing_showcase_prices_description(),
      cta: m.marketing_showcase_prices_cta(),
      to: "/cards",
      vignette: <PricesVignette />,
    },
  ] as const;

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-16 md:gap-24 md:py-24">
      {features.map((feature, index) => (
        <Reveal key={feature.title}>
          <Link
            to={feature.to}
            className="hover:bg-background/60 group grid items-center gap-8 rounded-2xl p-4 transition-colors sm:p-6 lg:grid-cols-2 lg:gap-14"
          >
            <div className={cn("flex flex-col gap-4", index % 2 === 1 && "lg:order-2")}>
              <Heading level={1} as="h2">
                {feature.title}
              </Heading>
              <OrnamentRule className="w-40" />
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              <span className="text-primary flex items-center gap-1.5 text-sm font-medium">
                {feature.cta}
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </div>
            <div className={cn(index % 2 === 1 && "lg:order-1")}>{feature.vignette}</div>
          </Link>
        </Reveal>
      ))}
    </section>
  );
}

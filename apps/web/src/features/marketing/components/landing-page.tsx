import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { landingSummaryQueryOptions } from "@/features/marketing/lib/landing-summary-queries";
import { landingSamples } from "@/features/marketing/lib/page-samples";
import { useCountUp } from "@/hooks/use-count-up";
import { useIdlePreloadRoute } from "@/hooks/use-idle-preload-route";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { CardFan } from "./card-fan";
import { FeatureShowcase } from "./feature-showcase";
import { HeroBackground } from "./hero-background";
import { HeroCtas } from "./hero-ctas";
import { LandingClosing } from "./landing-closing";

const HINT_DURATION_MS = 400;
const SPIN_DURATION_MS = 1000;

function HeroStats({
  cardCount,
  printingCount,
  copyCount,
}: {
  cardCount: number;
  printingCount: number;
  copyCount: number;
}) {
  const numberClass = "font-heading text-muted-foreground font-semibold";
  return (
    <p className="text-muted-foreground/50 text-left text-sm tabular-nums">
      <span className={numberClass}>{formatCount(cardCount)}</span>{" "}
      {m.marketing_landing_stats_cards()} &middot;{" "}
      <span className={numberClass}>{formatCount(printingCount)}</span>{" "}
      {m.marketing_landing_stats_printings()} &middot;{" "}
      <span className={numberClass}>{formatCount(copyCount)}</span>{" "}
      {m.marketing_landing_stats_copies()}
    </p>
  );
}

export function LandingPage() {
  const { data } = useQuery(landingSummaryQueryOptions);
  const [spinning, setSpinning] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [hinting, setHinting] = useState(false);

  useIdlePreloadRoute("/cards");

  const animatedCards = useCountUp(data?.cardCount ?? 0);
  const animatedPrintings = useCountUp(data?.printingCount ?? 0);
  const animatedCopies = useCountUp(data?.copyCount ?? 0);

  function handleLogoTap() {
    setHinting(true);
    setTimeout(() => setHinting(false), HINT_DURATION_MS);
  }

  function handleAllCollected() {
    setSpinning(true);
    setTimeout(() => {
      setSpinning(false);
      setResetKey((key) => key + 1);
    }, SPIN_DURATION_MS);
  }

  const samples = landingSamples(data);

  return (
    <HeroBackground>
      {/* Extra top padding below lg: the stacked column can exceed the
          viewport, and justify-center would pin the logo under the header. */}
      <div className="relative flex min-h-[calc(100svh-var(--header-height))] flex-col justify-center p-4 pt-12 lg:pt-4">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
          <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="ghost"
                aria-label="OpenRift"
                className="h-auto cursor-pointer rounded-2xl p-0 hover:bg-transparent dark:hover:bg-transparent"
                onClick={handleLogoTap}
              >
                <img
                  src="/logo-color.svg"
                  alt=""
                  fetchPriority="high"
                  className={cn("size-16", spinning && "animate-logo-spin")}
                />
              </Button>
              <span className="font-heading text-4xl font-bold md:text-5xl">OpenRift</span>
            </div>
            <Heading level={1} className="text-balance md:text-4xl">
              {m.marketing_landing_headline()}
            </Heading>
            <p className="text-muted-foreground text-left text-lg">
              {m.marketing_landing_subhead()}
            </p>
            <HeroCtas source="home-hero" />
            <p className="text-muted-foreground">
              <ParaglideMessage
                message={m.marketing_landing_install}
                markup={{
                  link: ({ children }) => (
                    <TextLink render={<Link to="/install" />}>{children}</TextLink>
                  ),
                }}
              />
            </p>
            {data && (
              <HeroStats
                cardCount={animatedCards}
                printingCount={animatedPrintings}
                copyCount={animatedCopies}
              />
            )}
          </div>
          <CardFan
            key={resetKey}
            imageUrls={samples.fanUrls}
            hinting={hinting}
            onAllCollected={handleAllCollected}
          />
        </div>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-1"
        >
          <span className="text-muted-foreground/60 text-sm">
            {m.marketing_landing_scroll_hint()}
          </span>
          <ChevronDownIcon className="text-muted-foreground/40 size-6 motion-safe:animate-bounce" />
        </span>
      </div>
      <FeatureShowcase scanCards={samples.scanCards} thumbnailUrls={samples.groupUrls} />
      <LandingClosing />
    </HeroBackground>
  );
}

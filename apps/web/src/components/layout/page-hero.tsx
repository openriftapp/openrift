import type { ReactNode } from "react";

import { OrnamentRule } from "@/components/ui/ornament";
import { MiniCardArt } from "@/features/marketing/components/vignette-parts";
import { cn, PAGE_WIDTH } from "@/lib/utils";

// Hand-authored layout primitive: the alternative to PageTopBar for a page
// that opens with an introduction. It does not stick.

export const PAGE_HERO_EYEBROW_CLASS =
  "text-primary font-heading text-sm font-semibold tracking-wide uppercase";

export function PageHero({
  eyebrow,
  title,
  lead,
  aside,
  compactTitle = false,
  compactOnPhone = false,
  phoneFacts = [],
  width = "capped",
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  aside?: ReactNode;
  compactTitle?: boolean;
  compactOnPhone?: boolean;
  phoneFacts?: readonly string[];
  width?: keyof typeof PAGE_WIDTH;
  children?: ReactNode;
}) {
  return (
    <section className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "var(--hero-glow)" }}
      />
      <div
        className={cn(
          PAGE_WIDTH[width],
          "px-safe relative flex items-center gap-12",
          compactOnPhone ? "pt-5 pb-1 md:pt-12 md:pb-10" : "pt-10 pb-8 sm:pt-12 sm:pb-10",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col items-start gap-3",
            compactOnPhone && "max-md:gap-2",
          )}
        >
          {typeof eyebrow === "string" ? (
            <span className={cn(PAGE_HERO_EYEBROW_CLASS, compactOnPhone && "max-md:hidden")}>
              {eyebrow}
            </span>
          ) : (
            eyebrow
          )}
          <h1
            className={cn(
              "font-heading font-bold text-balance",
              compactOnPhone ? "text-2xl" : "text-4xl",
              compactTitle ? compactOnPhone && "md:text-4xl" : "md:text-5xl",
            )}
          >
            {title}
          </h1>
          {compactOnPhone && phoneFacts.length > 0 && (
            <p className="text-muted-foreground text-sm md:hidden">{phoneFacts.join(" · ")}</p>
          )}
          <OrnamentRule className={cn("w-40", compactOnPhone && "max-md:hidden")} />
          {lead !== undefined && (
            <p
              className={cn(
                "text-muted-foreground max-w-lg text-pretty",
                compactOnPhone && "max-md:hidden",
              )}
            >
              {lead}
            </p>
          )}
          {children}
        </div>
        {aside}
      </div>
    </section>
  );
}

export interface PageHeroStat {
  key: string;
  label: string;
  value: ReactNode;
}

export function PageHeroStats({
  stats,
  className,
}: {
  stats: readonly PageHeroStat[];
  className?: string;
}) {
  return (
    <dl className={cn("mt-3 flex flex-wrap gap-x-9 gap-y-3", className)}>
      {stats.map((stat) => (
        <div key={stat.key} className="flex flex-col-reverse gap-0.5">
          <dt className="text-muted-foreground text-sm">{stat.label}</dt>
          <dd className="font-heading text-3xl leading-none font-bold tabular-nums">
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const FAN_SLOTS = [
  "z-10",
  "-translate-x-[118%] translate-y-6 -rotate-11",
  "translate-x-[18%] translate-y-6 rotate-11",
];

export function PageHeroCardFan({ urls }: { urls: readonly string[] }) {
  if (urls.length === 0) {
    return null;
  }
  return (
    <div className="relative hidden h-64 w-80 shrink-0 md:block" aria-hidden="true">
      {urls.slice(0, 3).map((url, index) => (
        <MiniCardArt
          key={url}
          url={url}
          className={cn(
            "absolute top-2 left-1/2 w-36 -translate-x-1/2 shadow-xl",
            FAN_SLOTS[index],
          )}
        />
      ))}
    </div>
  );
}

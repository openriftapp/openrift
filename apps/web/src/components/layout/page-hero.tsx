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
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lead: ReactNode;
  aside?: ReactNode;
  compactTitle?: boolean;
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
          PAGE_WIDTH.capped,
          "px-safe relative flex items-center gap-12 pt-10 pb-8 sm:pt-12 sm:pb-10",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
          {typeof eyebrow === "string" ? (
            <span className={PAGE_HERO_EYEBROW_CLASS}>{eyebrow}</span>
          ) : (
            eyebrow
          )}
          <h1
            className={cn(
              "font-heading text-4xl font-bold text-balance",
              !compactTitle && "md:text-5xl",
            )}
          >
            {title}
          </h1>
          <OrnamentRule className="w-40" />
          <p className="text-muted-foreground max-w-lg text-pretty">{lead}</p>
          {children}
        </div>
        {aside}
      </div>
    </section>
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

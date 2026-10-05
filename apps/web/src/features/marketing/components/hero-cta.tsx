import { createLink } from "@tanstack/react-router";
import type { AnchorHTMLAttributes } from "react";
import { forwardRef } from "react";

import { cornerClip } from "@/features/marketing/components/clip-frame";
import { cn } from "@/lib/utils";

const CTA_CLIP = cornerClip(12);

// ring-inset because the clip-path would cut off an outset focus ring.
const CTA_BASE =
  "focus-visible:ring-ring font-heading inline-flex h-11 items-center px-7 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset";

type HeroCtaAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: "primary" | "outline";
};

const HeroCtaAnchor = forwardRef<HTMLAnchorElement, HeroCtaAnchorProps>(
  // oxlint-disable-next-line react/function-component-definition -- a forwardRef render function is a callback, so the function-expression form this rule wants trips prefer-arrow-callback instead
  ({ variant = "primary", className, style, children, ...rest }, ref) => {
    if (variant === "primary") {
      return (
        <a
          ref={ref}
          {...rest}
          className={cn(
            CTA_BASE,
            "bg-primary text-primary-foreground hover:bg-primary/90 font-semibold",
            className,
          )}
          style={{ ...style, clipPath: CTA_CLIP }}
        >
          {children}
        </a>
      );
    }
    // clip-path clips the border off the diagonal edge, so the gold hairline
    // is a clipped wrapper showing through 1px of padding.
    return (
      <span
        className={cn("bg-border-accent inline-block p-px", className)}
        style={{ clipPath: CTA_CLIP }}
      >
        <a
          ref={ref}
          {...rest}
          className={cn(CTA_BASE, "bg-background hover:bg-secondary font-medium")}
          style={{ ...style, clipPath: CTA_CLIP }}
        >
          {children}
        </a>
      </span>
    );
  },
);
HeroCtaAnchor.displayName = "HeroCtaAnchor";

export const HeroCta = createLink(HeroCtaAnchor);

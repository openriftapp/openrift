import { enumLabel } from "@openrift/shared/enum-label";
import { WellKnown } from "@openrift/shared/well-known";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEnumOrders } from "@/hooks/use-enums";
import { getFilterIconPath } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * `decorative` drops the alt text and the tooltip, for an icon next to a visible label.
 * The colorless glyph is a `currentColor` SVG, which an `<img>` paints black, so it is tinted to the theme.
 */
export function DomainIcon({
  domain,
  tooltip = true,
  decorative = false,
  className,
}: {
  domain: string;
  tooltip?: boolean;
  decorative?: boolean;
  className?: string;
}) {
  const { labels } = useEnumOrders();
  const domainIcon = getFilterIconPath("domains", domain);
  if (!domainIcon) {
    return null;
  }
  const label = enumLabel(labels.domains, domain);
  const icon = (
    <img
      src={domainIcon}
      alt={decorative ? "" : label}
      aria-hidden={decorative || undefined}
      className={cn(
        "size-6",
        domain === WellKnown.domain.COLORLESS && "brightness-0 dark:invert",
        className,
      )}
    />
  );
  if (decorative || !tooltip) {
    return icon;
  }
  return (
    <Tooltip>
      {/* Base UI's default trigger element renders as a button, which would
          make a decorative icon a tab stop on every domain of every tile. */}
      <TooltipTrigger render={<span />}>{icon}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

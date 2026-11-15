import type { LabelMap } from "@openrift/shared/enum-label";
import { enumLabel } from "@openrift/shared/enum-label";
import { WellKnown } from "@openrift/shared/well-known";

import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { getDomainColor } from "@/lib/domain";
import { getFilterIconPath } from "@/lib/icons";
import { m } from "@/paraglide/messages.js";

// `/images/domains/colorless.svg` is the colorless *domain's* icon, not a
// wild/any-domain glyph; the rainbow rune is used for that instead.
const WILD_RUNE_ICON = "/images/glyphs/rune-rainbow.svg";

export function PowerDomainIcon({
  domains,
  colors,
}: {
  domains: string[];
  colors: Record<string, string>;
}) {
  const domain = domains[0] ?? WellKnown.domain.COLORLESS;
  if (domains.length === 1 && domain !== WellKnown.domain.COLORLESS) {
    const domainIcon = getFilterIconPath("domains", domain);
    return domainIcon ? (
      <ImgWithFallback src={domainIcon} alt="" className="inline size-3" fallback={null} />
    ) : null;
  }
  // These glyphs are `currentColor` SVGs; inside an <img> that paints black
  // and vanishes in dark mode, so they're masked and tinted instead.
  const icon =
    domains.length > 1 ? WILD_RUNE_ICON : getFilterIconPath("domains", WellKnown.domain.COLORLESS);
  const c1 = getDomainColor(domain, colors);
  const c2 = getDomainColor(domains[1] ?? domain, colors);
  return (
    <span
      aria-hidden
      className="inline-block size-3"
      style={{
        background: `linear-gradient(135deg, ${c1} 30%, ${c2} 70%)`,
        mask: `url(${icon}) center / contain no-repeat`,
        WebkitMask: `url(${icon}) center / contain no-repeat`,
      }}
    />
  );
}

export function PowerPips({
  power,
  domains,
  colors,
  domainLabels,
}: {
  power: number | null;
  domains: string[];
  colors: Record<string, string>;
  domainLabels: LabelMap;
}) {
  if (power === null || power <= 0) {
    return null;
  }
  const named = domains.map((domain) => enumLabel(domainLabels, domain)).join(", ");
  const label =
    named.length > 0
      ? m.decks_editor_power_with_domains({ power, domains: named })
      : m.decks_editor_power({ power });
  return (
    <span role="img" aria-label={label} className="flex shrink-0 items-center gap-0.5">
      {Array.from({ length: power }, (_, index) => (
        <PowerDomainIcon key={index} domains={domains} colors={colors} />
      ))}
    </span>
  );
}

export function EnergyGlyph({ value }: { value: number }) {
  return (
    <span
      role="img"
      aria-label={m.decks_editor_energy({ value })}
      className="text-2xs flex size-4 shrink-0 items-center justify-center rounded-full bg-white leading-none font-bold text-[#013951]"
    >
      {value}
    </span>
  );
}

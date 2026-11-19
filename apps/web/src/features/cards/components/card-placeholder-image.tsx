import { legendDisplayName } from "@openrift/shared/card-name";
import type { CardType, Domain, Rarity } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import type { CSSProperties } from "react";
import { useId } from "react";

import { CardFlavorBand } from "@/features/cards/components/card-flavor-band";
import { CardText } from "@/features/cards/components/card-text";
import {
  CARD_FACE_MARK,
  CARD_FACE_REGION as REGION,
  CARD_TEXT_COLUMN_CLASS,
  typeIconColor,
} from "@/features/cards/lib/card-face";
import { useDomainColors } from "@/hooks/use-domain-colors";
import { getDomainGradientStyle, getPipBackgroundStyle, getPipGlyphTint } from "@/lib/domain";
import { getFilterIconPath, getTypeIconPaths } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { getCachedTintedIcon, TINT_BLACK, TINT_WHITE } from "@/lib/white-icon";
import { m } from "@/paraglide/messages.js";

const GLYPH_TINT: Record<string, string> = { white: TINT_WHITE, black: TINT_BLACK };

/**
 * `tinted` uses a pre-tinted raster; html2canvas-pro (the card designer's
 * export clone) ignores CSS filters and masks.
 */
export function GlyphIcon({
  src,
  className,
  tinted,
  color = "white",
}: {
  src?: string;
  className?: string;
  tinted?: boolean;
  color?: string;
}) {
  if (!src) {
    return null;
  }
  const tintColor = GLYPH_TINT[color] ?? color;
  const cached = tinted ? getCachedTintedIcon(src, tintColor) : undefined;
  if (cached) {
    return <img src={cached} alt="" aria-hidden="true" className={className} />;
  }
  if (color === "white" || color === "black") {
    const filter = color === "black" ? "brightness-0" : "brightness-0 invert";
    return <img src={src} alt="" aria-hidden="true" className={cn(className, filter)} />;
  }
  return (
    <span
      aria-hidden="true"
      className={cn(className, "inline-block")}
      style={{
        backgroundColor: color,
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

const ENERGY_COLUMN_STYLE: CSSProperties = {
  left: `calc(${REGION.energy.left} + ${REGION.energy.width} / 2 - 5.85cqw)`,
  top: `calc(${REGION.energy.top} + ${REGION.energy.height} / 2 - 5.85cqw)`,
};

const MIGHT_BOX_STYLE: CSSProperties = {
  top: REGION.might.top,
  height: REGION.might.height,
  right: `calc(100% - ${REGION.might.left} - ${REGION.might.width})`,
  clipPath: "polygon(0 0, 100% 0, 100% 100%, 13% 100%)",
};

interface CardPlaceholderImageProps {
  name: string;
  domain: Domain[];
  energy: number | null;
  might?: number | null;
  power?: number | null;
  types?: CardType[];
  superTypes?: string[];
  tags?: string[];
  rulesText?: string | null;
  effectText?: string | null;
  mightBonus?: number | null;
  flavorText?: string | null;
  rarity?: Rarity;
  publicCode?: string;
  artist?: string;
  promoLabel?: string;
  backgroundImageUrl?: string;
  backgroundImageStyle?: CSSProperties;
  tintIcons?: boolean;
  className?: string;
}

export function CardPlaceholderImage({
  name: storedName,
  domain,
  energy,
  might,
  power,
  types,
  superTypes,
  tags,
  rulesText,
  effectText,
  mightBonus,
  flavorText,
  rarity,
  publicCode,
  artist,
  promoLabel,
  backgroundImageUrl,
  backgroundImageStyle,
  tintIcons,
  className,
}: CardPlaceholderImageProps) {
  const name = legendDisplayName({ name: storedName, types: types ?? [], tags: tags ?? [] });
  const domainColors = useDomainColors();
  const primaryDomain = domain[0] ?? WellKnown.domain.COLORLESS;
  const runePipIcon =
    domain.length > 1
      ? "/images/glyphs/rune-rainbow.svg"
      : getFilterIconPath("domains", primaryDomain);
  const runePipColor = getPipGlyphTint(domain, domainColors);
  const typeIconPaths = getTypeIconPaths(types ?? [], superTypes ?? []);
  const typeText = types?.join(" ") ?? "";
  const typeColor = typeIconColor(rarity);
  // Gear shows its energy cost in a rotated-diamond frame; any Gear type in
  // the set counts, so a Unit Gear also gets the diamond.
  const isGear = types?.includes(WellKnown.cardType.GEAR) ?? false;
  const bgStyle = getDomainGradientStyle(domain, "", domainColors);
  const noiseId = useId();

  return (
    <div
      className={cn(
        "aspect-card font-card @container relative overflow-hidden rounded-lg bg-neutral-800",
        className,
      )}
      role="img"
      aria-label={m.cards_placeholder_aria({
        name,
        energy: energy ?? m.cards_placeholder_stat_none(),
        might: might ?? m.cards_placeholder_stat_none(),
        power: power ?? m.cards_placeholder_stat_none(),
      })}
    >
      {backgroundImageUrl && (
        <img
          src={backgroundImageUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute object-cover"
          style={backgroundImageStyle ?? { top: 0, left: 0, width: "100%", height: "100%" }}
        />
      )}
      {backgroundImageUrl ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-linear-to-t from-black/85 via-black/55 to-transparent"
        />
      ) : (
        <>
          <svg
            className="pointer-events-none absolute inset-0 size-full opacity-15"
            aria-hidden="true"
          >
            <filter id={noiseId}>
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.7"
                numOctaves="4"
                stitchTiles="stitch"
              />
            </filter>
            <rect width="100%" height="100%" filter={`url(#${noiseId})`} />
          </svg>
          <GlyphIcon
            src="/logo.svg"
            tinted={tintIcons}
            className="pointer-events-none absolute top-[14%] left-1/2 size-[40cqw] -translate-x-1/2 opacity-15"
          />
        </>
      )}
      <div className="absolute flex flex-col items-start gap-[1cqw]" style={ENERGY_COLUMN_STYLE}>
        {energy !== null &&
          (isGear ? (
            <div
              className="relative flex size-[11.7cqw] items-center justify-center"
              aria-label={m.cards_placeholder_energy_aria({ value: energy })}
            >
              <span
                aria-hidden="true"
                className="absolute inset-[1.7cqw] rotate-45 bg-white/70 ring-1 ring-black/70"
              />
              <span className="font-numeric relative text-[8cqw] font-semibold text-black">
                {energy}
              </span>
            </div>
          ) : (
            <div
              className="font-numeric flex size-[11.7cqw] items-center justify-center rounded-full bg-white/70 text-[8cqw] font-semibold text-black ring-1 ring-black/70"
              aria-label={m.cards_placeholder_energy_aria({ value: energy })}
            >
              {energy}
            </div>
          ))}
        {types?.includes(WellKnown.cardType.LEGEND) &&
          domain.some((d) => d !== WellKnown.domain.COLORLESS) &&
          domain
            .filter((d) => d !== WellKnown.domain.COLORLESS)
            .map((d) => (
              <span
                key={d}
                className="flex size-[10cqw] items-center justify-center rounded-full"
                style={getDomainGradientStyle([d], "", domainColors)}
              >
                <GlyphIcon
                  src={getFilterIconPath("domains", d)}
                  tinted={tintIcons}
                  className="size-[6cqw]"
                />
              </span>
            ))}
        {power !== null && power !== undefined && power > 0 && runePipIcon && (
          <div
            className="mt-[1cqw] ml-[0cqw] flex flex-col items-center gap-[0.5cqw] rounded-[3cqw] px-[1cqw] py-[2.25cqw]"
            style={getPipBackgroundStyle(domain, domainColors)}
          >
            {Array.from({ length: power }, (_, index) => (
              <GlyphIcon
                key={index}
                src={runePipIcon}
                color={runePipColor}
                tinted={tintIcons}
                className="size-[4cqw]"
              />
            ))}
          </div>
        )}
      </div>

      {might !== null && might !== undefined && (
        <div
          className="font-numeric absolute flex items-stretch overflow-hidden text-[7.75cqw] font-semibold"
          style={MIGHT_BOX_STYLE}
          aria-label={m.cards_placeholder_might_aria({ value: might })}
        >
          <div className="flex items-center justify-center bg-white/70 pr-[0.5cqw] pl-[1.7cqw]">
            <GlyphIcon
              src="/images/might.svg"
              color="black"
              tinted={tintIcons}
              className="size-[6cqw]"
            />
          </div>
          <div className="flex items-center justify-center bg-black/70 pr-[2cqw] pl-[2.3cqw] text-white">
            {might}
          </div>
        </div>
      )}

      {(typeText || (tags && tags.length > 0)) && (
        <div
          className="absolute flex items-center gap-[1cqw]"
          style={{
            ...REGION.typeLine,
            left: `calc(${REGION.typeLine.left} + ${Math.max(typeIconPaths.length - 1, 0) * 8.25}cqw)`,
          }}
        >
          {typeText && (
            <span className="relative inline-flex items-center pr-[1.5cqw] pl-[1cqw]">
              <span className="absolute inset-0 -skew-x-[15deg]" style={bgStyle} />
              <span className="font-condensed relative text-[3.4cqw] font-semibold tracking-tighter text-white uppercase italic">
                {superTypes && superTypes.length > 0
                  ? `${superTypes.join(" ")} ${typeText}`
                  : typeText}
              </span>
            </span>
          )}
          {tags?.map((tag) => (
            <span key={tag} className="relative inline-flex items-center pr-[1.5cqw] pl-[1cqw]">
              <span className="absolute inset-0 -skew-x-[15deg] bg-black/90" />
              <span className="font-condensed relative text-[3.4cqw] font-semibold tracking-tighter text-white uppercase italic">
                {tag}
              </span>
            </span>
          ))}
        </div>
      )}

      <div
        className="font-display absolute inset-x-0 top-[55.25%] flex h-[12cqw] w-full items-center"
        style={{ ...bgStyle, paddingLeft: REGION.name.left, paddingRight: REGION.name.right }}
      >
        {name.includes(",") ? (
          <span className="flex flex-col text-white">
            <span className="-mt-[0.5cqw] text-[5cqw] font-semibold">
              {name.slice(0, name.indexOf(","))}
            </span>
            <span className="-mt-[2cqw] text-[3cqw] uppercase italic">
              {name.slice(name.indexOf(",") + 1).trim()}
            </span>
          </span>
        ) : (
          <span className="text-[6cqw] font-semibold text-white">{name}</span>
        )}
      </div>

      {typeIconPaths.length > 0 && (
        <div
          className="absolute flex -translate-y-1/2 items-center gap-[1cqw]"
          style={{
            left: `calc(${CARD_FACE_MARK.typeIcon.left} - 3.625cqw)`,
            top: CARD_FACE_MARK.typeIcon.top,
          }}
        >
          {typeIconPaths.map((path) => (
            <span
              key={path}
              className="relative flex h-[9.27cqw] w-[7.25cqw] items-center justify-center rounded-full bg-black"
            >
              <span
                aria-hidden="true"
                className="absolute inset-[0.67cqw] rounded-full border-[0.4cqw]"
                style={{ borderColor: typeColor }}
              />
              <GlyphIcon
                src={path}
                color={typeColor}
                tinted={tintIcons}
                className="size-[4.25cqw] -translate-y-[0.47cqw]"
              />
            </span>
          ))}
        </div>
      )}

      {/* Keywords stay non-interactive: nesting a <button> inside CardThumbnail's
          outer <button> makes Firefox auto-close it, ejecting the thumbnail's rest. */}
      {(rulesText ||
        effectText ||
        flavorText ||
        (mightBonus !== null && mightBonus !== undefined && mightBonus > 0)) && (
        <div className="card-text-scaled absolute flex flex-col text-[4cqw]" style={REGION.textBox}>
          <div className={cn("flex flex-1 flex-col", CARD_TEXT_COLUMN_CLASS)}>
            <div className="my-auto flex flex-col gap-[0.3em]">
              {rulesText && (
                <p className="leading-[1.2] text-white/80">
                  <CardText text={rulesText} interactive={false} surface="dark" />
                </p>
              )}
              {(effectText || (mightBonus !== null && mightBonus !== undefined)) && (
                <div
                  className="-mx-[2cqw] -my-[1cqw] flex items-start gap-[2cqw] rounded-[1.5cqw] px-[2cqw] py-[1cqw]"
                  style={getDomainGradientStyle(domain, "30", domainColors)}
                >
                  <div className="flex-1">
                    {effectText && (
                      <p className="leading-[1.2] text-white/80">
                        <CardText text={effectText} interactive={false} surface="dark" />
                      </p>
                    )}
                  </div>
                  {mightBonus !== null && mightBonus !== undefined && mightBonus > 0 && (
                    <div className="flex shrink-0 items-center gap-[0.5cqw]">
                      <img src="/images/might.svg" alt="" className="size-[1em]" />
                      <span className="font-bold text-white">+{mightBonus}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {flavorText && <CardFlavorBand text={flavorText} domains={domain} surface="dark" />}
        </div>
      )}

      {rarity && (
        <img
          src={getFilterIconPath("rarities", rarity, { size: "full" })}
          alt={rarity}
          className="absolute size-[2.8cqw] -translate-1/2 object-contain"
          style={CARD_FACE_MARK.rarity}
        />
      )}

      {promoLabel && (
        <span
          className="font-condensed absolute flex -translate-x-1/2 items-center text-[2.5cqw] font-semibold tracking-wider text-white/70 uppercase"
          style={{ left: "50%", top: REGION.footer.top, height: REGION.footer.height }}
        >
          {promoLabel}
        </span>
      )}

      <div
        className="absolute flex items-center justify-between text-[2.8cqw] text-white/70"
        style={{
          left: REGION.footer.left,
          right: `calc(100% - ${CARD_FACE_MARK.domain.left} - 2cqw)`,
          top: REGION.footer.top,
          height: REGION.footer.height,
        }}
      >
        <span>{publicCode}</span>
        <span className="flex items-center gap-[2.4cqw]">
          {artist && (
            <span className="flex items-center gap-[1cqw]">
              <GlyphIcon
                src="/images/artist.svg"
                tinted={tintIcons}
                className="size-[2.8cqw] opacity-70"
              />
              {artist}
            </span>
          )}
          <span className="flex min-w-[4cqw] -translate-y-[0.45cqw] items-center gap-[1cqw]">
            {domain
              .filter((d) => d !== WellKnown.domain.COLORLESS)
              .map((d) => (
                <span
                  key={d}
                  className="flex size-[4cqw] items-center justify-center rounded-full"
                  style={getDomainGradientStyle([d], "", domainColors)}
                >
                  <GlyphIcon
                    src={getFilterIconPath("domains", d)}
                    tinted={tintIcons}
                    className="size-[2.5cqw]"
                  />
                </span>
              ))}
          </span>
        </span>
      </div>
    </div>
  );
}

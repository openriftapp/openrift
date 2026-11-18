import { WellKnown } from "@openrift/shared/well-known";
import type { CSSProperties } from "react";
import { useLayoutEffect, useRef } from "react";

import { GlyphIcon } from "@/features/cards/components/card-placeholder-image";
import { CardText } from "@/features/cards/components/card-text";
import { shrinkToFit } from "@/features/designer/lib/fit-text";
import type { DesignerCard } from "@/features/designer/stores/card-designer-store";
import { useDomainColors } from "@/hooks/use-domain-colors";
import { getDomainGradientStyle } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/** Positions as percentages of the 744x1039 frame image. */
const REGION = {
  energy: { left: "6.32%", top: "5.39%", width: "10.48%", height: "7.51%" },
  might: { left: "84.54%", top: "5.39%", width: "8.2%", height: "6.26%" },
  typeLine: { left: "11.02%", top: "51.4%", height: "3.66%" },
  name: { left: "11.83%", right: "8%", top: "55.53%", height: "7.89%" },
  rules: { left: "11.4%", right: "11.4%", top: "64.3%", bottom: "8.57%" },
  footer: { left: "5.1%", right: "11.3%", top: "95.57%", height: "2.7%" },
} satisfies Record<string, CSSProperties>;

const RULES_TEXT_CQW = 4;

export function FramedCardImage({
  card,
  frameUrl,
  artist,
  backgroundImageUrl,
  backgroundImageStyle,
  tintIcons,
  onFrameError,
}: {
  card: DesignerCard;
  frameUrl: string;
  artist: string;
  backgroundImageUrl?: string;
  backgroundImageStyle?: CSSProperties;
  tintIcons?: boolean;
  onFrameError?: () => void;
}) {
  const domainColors = useDomainColors();
  const commaAt = card.name.indexOf(",");
  const hasBonus = card.mightBonus !== null;
  const showsMight = card.type === WellKnown.cardType.UNIT && card.might !== null;
  const rulesBoxRef = useRef<HTMLDivElement>(null);
  const rulesTextRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = rulesBoxRef.current;
    const content = rulesTextRef.current;
    if (!box || !content) {
      return;
    }
    const fit = () => shrinkToFit(box, content, RULES_TEXT_CQW);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(content);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="aspect-card font-card @container relative overflow-hidden rounded-lg bg-neutral-800"
      role="img"
      aria-label={m.cards_placeholder_aria({
        name: card.name,
        energy: card.energy ?? m.cards_placeholder_stat_none(),
        might: showsMight && card.might !== null ? card.might : m.cards_placeholder_stat_none(),
        power: m.cards_placeholder_stat_none(),
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
      <img
        src={frameUrl}
        onError={onFrameError}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full max-w-none"
      />

      {card.energy !== null && (
        <div
          className="font-numeric absolute flex items-center justify-center text-[8cqw] font-semibold text-black"
          style={REGION.energy}
        >
          {card.energy}
        </div>
      )}

      {showsMight && (
        <div
          className="font-numeric absolute flex items-center justify-center text-[7cqw] font-semibold text-white"
          style={REGION.might}
        >
          {card.might}
        </div>
      )}

      {(card.type || card.tags.length > 0) && (
        <div className="absolute flex items-center gap-[1cqw]" style={REGION.typeLine}>
          {card.type && (
            <TypeLinePill style={getDomainGradientStyle(card.domains, "", domainColors)}>
              {card.type}
            </TypeLinePill>
          )}
          {card.tags.map((tag) => (
            <TypeLinePill key={tag} className="bg-black">
              {tag}
            </TypeLinePill>
          ))}
        </div>
      )}

      <div
        className="font-display absolute flex items-center tracking-wide text-white"
        style={REGION.name}
      >
        {commaAt === -1 ? (
          <span className="text-[6cqw] font-semibold">{card.name}</span>
        ) : (
          <span className="flex flex-col">
            <span className="-mt-[0.5cqw] text-[5cqw] font-semibold">
              {card.name.slice(0, commaAt)}
            </span>
            <span className="-mt-[2cqw] text-[3cqw] uppercase italic">
              {card.name.slice(commaAt + 1).trim()}
            </span>
          </span>
        )}
      </div>

      <div
        ref={rulesBoxRef}
        className="absolute flex flex-col overflow-hidden"
        style={REGION.rules}
      >
        <div
          ref={rulesTextRef}
          className="card-text-scaled my-auto flex w-full flex-col gap-[0.4em] leading-[1.3] text-black"
          style={{ fontSize: `${RULES_TEXT_CQW}cqw` }}
        >
          {card.rulesText && (
            <p>
              <CardText text={card.rulesText} interactive={false} surface="light" />
            </p>
          )}
          {(card.effectText || hasBonus) && (
            <p>
              {card.effectText && (
                <CardText text={card.effectText} interactive={false} surface="light" />
              )}
              {hasBonus && (
                <span
                  className={cn(
                    "inline-flex items-center gap-[0.15em] font-bold whitespace-nowrap",
                    card.effectText && "ml-[0.3em]",
                  )}
                >
                  +{card.mightBonus}
                  <GlyphIcon
                    src="/images/might.svg"
                    color="black"
                    tinted={tintIcons}
                    className="size-[1em]"
                  />
                </span>
              )}
            </p>
          )}
          {card.flavorText && <p className="text-black/60 italic">{card.flavorText}</p>}
        </div>
      </div>

      <div
        className="absolute flex items-center justify-between text-[2.3cqw] text-white/80"
        style={REGION.footer}
      >
        <span>{card.publicCode}</span>
        {artist && (
          <span className="flex items-center gap-[1cqw]">
            <GlyphIcon
              src="/images/artist.svg"
              tinted={tintIcons}
              className="size-[2.3cqw] opacity-80"
            />
            {artist}
          </span>
        )}
      </div>
    </div>
  );
}

function TypeLinePill({
  children,
  className,
  style,
}: {
  children: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className="relative inline-flex items-center pr-[1.5cqw] pl-[1cqw]">
      <span className={cn("absolute inset-0 -skew-x-[15deg]", className)} style={style} />
      <span className="font-condensed relative text-[3.4cqw] font-semibold tracking-tighter text-white uppercase italic">
        {children}
      </span>
    </span>
  );
}

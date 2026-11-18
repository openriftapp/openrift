import type { CardTextToken } from "@openrift/shared/card-text";
import { tokenizeCardText } from "@openrift/shared/card-text";
import type { KeywordsResponse } from "@openrift/shared/types/api/keyword";

import { getKeywordStyle } from "@/features/cards/lib/keywords";
import { useKeywordReverseMap } from "@/hooks/use-keyword-reverse-map";
import { useKeywordStyles } from "@/hooks/use-keyword-styles";
import { glyphPath } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { getCachedTintedIcon, TINT_BLACK } from "@/lib/white-icon";
import { m } from "@/paraglide/messages.js";

function keywordClipPath(pointedRight?: boolean, pointedLeft?: boolean): string {
  if (pointedLeft && pointedRight) {
    return "polygon(0% 0%, calc(100% - 0.3em) 0%, 100% 50%, calc(100% - 0.3em) 100%, 0% 100%, 0.3em 50%)";
  }
  if (pointedLeft) {
    return "polygon(0% 0%, 100% 0%, calc(100% - 0.3em) 100%, 0% 100%, 0.3em 50%)";
  }
  if (pointedRight) {
    return "polygon(0.3em 0%, calc(100% - 0.3em) 0%, 100% 50%, calc(100% - 0.3em) 100%, 0% 100%)";
  }
  return "polygon(0.3em 0%, 100% 0%, calc(100% - 0.3em) 100%, 0% 100%)";
}

type TextSurface = "dark" | "light";

const ENERGY_GLYPH_CLASS = {
  theme: "bg-foreground text-background",
  dark: "bg-white text-black",
  light: "bg-black text-white",
};

const MONO_GLYPH_CLASS = {
  theme: "brightness-0 dark:invert",
  dark: "brightness-0 invert",
  light: "brightness-0",
};

interface CardTextProps {
  text: string;
  onKeywordClick?: (keyword: string) => void;
  interactive?: boolean;
  surface?: TextSurface;
}

export function CardText({ text, onKeywordClick, interactive = true, surface }: CardTextProps) {
  const styles = useKeywordStyles();
  const reverseMap = useKeywordReverseMap();
  return renderTokens(
    tokenizeCardText(text),
    styles,
    interactive ? onKeywordClick : undefined,
    interactive,
    reverseMap,
    surface,
  );
}

export function CardTextTokens({
  tokens,
  onKeywordClick,
  interactive = false,
}: {
  tokens: CardTextToken[];
  onKeywordClick?: (keyword: string) => void;
  interactive?: boolean;
}) {
  const styles = useKeywordStyles();
  const reverseMap = useKeywordReverseMap();
  return renderTokens(
    tokens,
    styles,
    interactive ? onKeywordClick : undefined,
    interactive,
    reverseMap,
  );
}

function renderTokens(
  tokens: CardTextToken[],
  styles: KeywordsResponse["items"],
  onKeywordClick?: (keyword: string) => void,
  interactive = true,
  reverseMap?: Map<string, string>,
  surface?: TextSurface,
): React.ReactNode[] {
  return tokens.map((token, i) => {
    switch (token.type) {
      case "glyph": {
        const energyMatch = /^energy_?(?<level>\d+)$/u.exec(token.name);
        if (energyMatch) {
          return (
            <span
              key={`${i}-${token.name}`}
              aria-label={m.cards_text_energy_aria({ value: energyMatch[1] ?? "" })}
              className={cn(
                // -0.179em matches the glyph images' -0.125em offset at this element's own 0.7em font-size.
                "inline-block size-[1.45em] overflow-hidden rounded-full text-center align-[-0.179em] text-[0.7em] leading-[1.45em] font-bold not-italic",
                ENERGY_GLYPH_CLASS[surface ?? "theme"],
              )}
            >
              {energyMatch[1]}
            </span>
          );
        }
        const monoWhite = token.name === "might" || token.name === "exhaust";
        const src = glyphPath(token.name);
        // html2canvas ignores the filter, so an export on a light surface needs the pre-tinted raster.
        const tinted =
          monoWhite && surface === "light" ? getCachedTintedIcon(src, TINT_BLACK) : undefined;
        return (
          <img
            key={`${i}-${token.name}`}
            src={tinted ?? src}
            alt={token.name.replaceAll("_", " ")}
            className={cn(
              "inline-block size-[1em] align-[-0.125em]",
              monoWhite && !tinted && MONO_GLYPH_CLASS[surface ?? "theme"],
            )}
          />
        );
      }
      case "keyword": {
        const kw = getKeywordStyle(token.name, styles, reverseMap);
        const Tag = interactive ? "button" : "span";
        return (
          <Tag
            key={`${i}-kw`}
            {...(interactive ? { type: "button" as const } : {})}
            className={cn(
              "relative inline-flex items-center pr-2.5 pl-2 align-baseline",
              interactive && "cursor-pointer",
              onKeywordClick && "hover:brightness-125",
            )}
            onClick={
              interactive ? () => onKeywordClick?.(token.name.replace(/\s+\d+$/u, "")) : undefined
            }
          >
            <span
              className="absolute inset-0"
              style={{
                backgroundColor: kw.bg,
                clipPath: keywordClipPath(token.pointedRight, token.pointedLeft),
              }}
            />
            <span
              className={cn(
                "relative text-[0.8em] font-semibold tracking-tight uppercase italic",
                kw.dark ? "text-black" : "text-white",
              )}
            >
              {renderTokens(
                token.children,
                styles,
                onKeywordClick,
                interactive,
                reverseMap,
                surface,
              )}
            </span>
          </Tag>
        );
      }
      case "paren": {
        return (
          <span key={`${i}-paren`} className="italic">
            (
            {renderTokens(token.children, styles, onKeywordClick, interactive, reverseMap, surface)}
            )
          </span>
        );
      }
      case "italic": {
        return (
          <span key={`${i}-italic`} className="italic">
            {renderTokens(token.children, styles, onKeywordClick, interactive, reverseMap, surface)}
          </span>
        );
      }
      case "newline": {
        return <span key={`${i}-br`} className="block h-2" />;
      }
      case "text": {
        return token.value;
      }
      default: {
        return null;
      }
    }
  });
}

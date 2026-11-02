import type { Printing } from "@openrift/shared/types/catalog";

import { OrnamentBase } from "@/components/ui/ornament";
import { RarityIcon } from "@/features/cards/components/rarity-icon";
import { useDomainColors } from "@/hooks/use-domain-colors";
import { getDomainGradientStyle } from "@/lib/domain";
import { htmlLangTag } from "@/lib/language-tag";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import type { ErrataChange } from "./errata-notice";
import { ErrataCardText, ErrataScope } from "./errata-notice";
import { StatChip } from "./stat-chip";

/**
 * The card's flavor line. Its own component because the stream overlay and the
 * presentation stage switch flavor on and off separately from the rules text,
 * and there it renders without the blocks above it.
 */
export function CardDetailFlavorText({ printing }: { printing: Printing }) {
  if (!printing.flavorText) {
    return null;
  }
  return (
    <p
      lang={htmlLangTag(printing.language)}
      className="text-muted-foreground/70 px-1 text-sm italic"
    >
      {printing.flavorText}
    </p>
  );
}

function errataChanges(printing: Printing): ErrataChange[] {
  const { errata } = printing.card;
  const changes: ErrataChange[] = [];
  if (errata?.correctedRulesText && printing.printedRulesText !== errata.correctedRulesText) {
    changes.push({
      key: "rules",
      printed: printing.printedRulesText ?? "",
      corrected: errata.correctedRulesText,
    });
  }
  if (
    errata?.correctedEffectText &&
    printing.printedEffectText &&
    printing.printedEffectText !== errata.correctedEffectText
  ) {
    changes.push({
      key: "effect",
      printed: printing.printedEffectText,
      corrected: errata.correctedEffectText,
    });
  }
  return changes;
}

/**
 * Rules, effect and flavor in one text box closed by the bracket base and rarity
 * medallion. Errata marks in the text open one comparison for the box.
 */
export function CardDetailText({
  printing,
  onKeywordClick,
  showFlavorText = true,
  interactive = true,
}: {
  printing: Printing;
  onKeywordClick?: (keyword: string) => void;
  showFlavorText?: boolean;
  interactive?: boolean;
}) {
  const { card } = printing;
  const domainColors = useDomainColors();
  const hasEffect =
    Boolean(printing.printedEffectText) || (card.mightBonus !== null && card.mightBonus > 0);
  const hasFlavor = showFlavorText && Boolean(printing.flavorText);
  if (!printing.printedRulesText && !hasEffect && !hasFlavor) {
    return null;
  }
  const textLang = htmlLangTag(printing.language);
  const changes = interactive ? errataChanges(printing) : [];

  return (
    <ErrataScope cardSlug={card.slug} errata={card.errata} changes={changes} lang={textLang}>
      <div className="flex flex-col pt-2">
        <div className="bg-muted/30 border-border-accent space-y-3 rounded-t-lg border border-b-0 px-3 pt-2.5 pb-2">
          {printing.printedRulesText && (
            <p lang={textLang} className="text-muted-foreground text-sm">
              <ErrataCardText
                printed={printing.printedRulesText}
                corrected={card.errata?.correctedRulesText ?? printing.printedRulesText}
                onKeywordClick={onKeywordClick}
                interactive={interactive}
              />
            </p>
          )}

          {hasEffect && (
            <div
              className="rounded-md px-3 py-2.5"
              style={getDomainGradientStyle(card.domains, "18", domainColors)}
            >
              {printing.printedEffectText && (
                <p lang={textLang} className="text-muted-foreground text-sm">
                  <ErrataCardText
                    printed={printing.printedEffectText}
                    corrected={card.errata?.correctedEffectText ?? printing.printedEffectText}
                    onKeywordClick={onKeywordClick}
                    interactive={interactive}
                  />
                </p>
              )}
              {card.mightBonus !== null && card.mightBonus > 0 && (
                <div className={cn(printing.printedEffectText && "mt-2")}>
                  <StatChip
                    label={m.card_detail_stat_might_bonus()}
                    value={`+${card.mightBonus}`}
                    icon="/images/might.svg"
                  />
                </div>
              )}
            </div>
          )}

          {hasFlavor && <CardDetailFlavorText printing={printing} />}
        </div>
        <OrnamentBase surfaceClassName="bg-muted/30" aria-hidden={false}>
          <RarityIcon rarity={printing.rarity} labelled className="size-4" />
        </OrnamentBase>
      </div>
    </ErrataScope>
  );
}

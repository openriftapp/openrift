import { Link } from "@tanstack/react-router";

import { TextLink } from "@/components/ui/text-link";
import { formatLanguageAggregate } from "@/features/cards/lib/promo-sections";
import { m } from "@/paraglide/messages.js";

export function PromosIntro({
  languageLabel,
  aggregate,
}: {
  languageLabel: string;
  aggregate: { printingCount: number; cardCount: number } | undefined;
}) {
  return (
    <div className="mb-6">
      <p className="text-muted-foreground text-sm">
        {m.promos_intro_lead()} {m.promos_intro_markers()}
      </p>
      {aggregate && (
        <p className="text-muted-foreground mt-2 text-sm">
          {formatLanguageAggregate(languageLabel, aggregate.printingCount, aggregate.cardCount)}{" "}
          {m.promos_intro_contribute()}{" "}
          <TextLink render={<Link to="/contribute" />}>{m.promos_intro_contribute_link()}</TextLink>
          .
        </p>
      )}
    </div>
  );
}

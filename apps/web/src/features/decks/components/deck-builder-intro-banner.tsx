import type { DeckFormat } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { Link } from "@tanstack/react-router";

import { IntroBanner } from "@/components/intro-banner";
import { Callout } from "@/components/ui/callout";
import { TextLink } from "@/components/ui/text-link";
import { m } from "@/paraglide/messages.js";

function introStepTitles(format: DeckFormat): readonly string[] {
  return [
    m.decks_intro_step_legend_title(),
    m.decks_intro_step_champion_title(),
    format === WellKnown.deckFormat.CUSTOM_REGION
      ? m.decks_intro_step_battlefield_one_title()
      : m.decks_intro_step_battlefield_many_title(),
    m.decks_intro_step_main_title(),
  ];
}

// Dismissed for good once closed; the flag lives in the onboarding store.
export function DeckBuilderIntroBanner({
  format,
  onDismiss,
}: {
  format: DeckFormat;
  onDismiss: () => void;
}) {
  return (
    <IntroBanner
      title={m.decks_intro_title()}
      lead={m.decks_intro_lead()}
      onDismiss={onDismiss}
      bodyClassName="mx-auto max-w-5xl"
    >
      <ol className="grid grid-cols-2 gap-1.5 @lg:grid-cols-4">
        {introStepTitles(format).map((title, index) => (
          <li key={title}>
            <Callout variant="inset" className="flex h-full items-center gap-2 p-2 text-sm">
              <span className="bg-primary/10 text-primary flex size-5 shrink-0 items-center justify-center rounded-full font-semibold">
                {index + 1}
              </span>
              <span className="font-medium">{title}</span>
            </Callout>
          </li>
        ))}
      </ol>
      <p>
        <TextLink render={<Link to="/help/$slug" params={{ slug: "deck-building" }} />}>
          {m.decks_intro_read_guide()}
        </TextLink>
      </p>
    </IntroBanner>
  );
}

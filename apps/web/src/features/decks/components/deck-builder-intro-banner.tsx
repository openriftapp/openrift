import type { DeckFormat } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { Link } from "@tanstack/react-router";

import { IntroBanner } from "@/components/intro-banner";
import { Callout } from "@/components/ui/callout";
import { TextLink } from "@/components/ui/text-link";
import { m } from "@/paraglide/messages.js";

function introSteps(format: DeckFormat): readonly { title: string; description: string }[] {
  const singleBattlefield = format === WellKnown.deckFormat.CUSTOM_REGION;
  return [
    { title: m.decks_intro_step_legend_title(), description: m.decks_intro_step_legend_desc() },
    {
      title: m.decks_intro_step_champion_title(),
      description: m.decks_intro_step_champion_desc(),
    },
    singleBattlefield
      ? {
          title: m.decks_intro_step_battlefield_one_title(),
          description: m.decks_intro_step_battlefield_one_desc(),
        }
      : {
          title: m.decks_intro_step_battlefield_many_title(),
          description: m.decks_intro_step_battlefield_many_desc(),
        },
    { title: m.decks_intro_step_main_title(), description: m.decks_intro_step_main_desc() },
  ];
}

function introTips(): readonly string[] {
  return [m.decks_intro_tip_add(), m.decks_intro_tip_autosave()];
}

// Dismissed for good once closed; the flag lives in the onboarding store.
export function DeckBuilderIntroBanner({
  format,
  onDismiss,
}: {
  format: DeckFormat;
  onDismiss: () => void;
}) {
  const formatTip =
    format === WellKnown.deckFormat.CONSTRUCTED
      ? m.decks_intro_format_constructed()
      : format === WellKnown.deckFormat.CUSTOM_REGION
        ? m.decks_intro_format_custom_region()
        : m.decks_intro_format_freeform();
  return (
    <IntroBanner
      bodyClassName="mx-auto max-w-5xl"
      title={m.decks_intro_title()}
      lead={m.decks_intro_lead()}
      onDismiss={onDismiss}
    >
      <div className="grid gap-4 @lg:grid-cols-2">
        <ol className="grid gap-2 self-start">
          {introSteps(format).map((step, index) => (
            <li key={step.title}>
              <Callout variant="inset" className="flex items-start gap-2">
                <span className="bg-primary/10 text-primary flex size-5 shrink-0 items-center justify-center rounded-full font-semibold">
                  {index + 1}
                </span>
                <div>
                  <span className="font-medium">{step.title}</span>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </Callout>
            </li>
          ))}
        </ol>
        <div>
          <p className="font-medium">{m.decks_intro_good_to_know()}</p>
          <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-5">
            <li>
              {m.decks_intro_printings_before()}{" "}
              <TextLink
                render={<Link to="/help/$slug" params={{ slug: "cards-printings-copies" }} />}
              >
                {m.decks_intro_printings_link()}
              </TextLink>
              {m.decks_intro_printings_after()}
            </li>
            {introTips().map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
            <li>{formatTip}</li>
          </ul>
        </div>
      </div>
      <TextLink render={<Link to="/help/$slug" params={{ slug: "deck-building" }} />}>
        {m.decks_intro_read_guide()}
      </TextLink>
    </IntroBanner>
  );
}

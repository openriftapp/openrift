import type { DeckFormat } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { Link } from "@tanstack/react-router";
import { InfoIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    <Callout className="flex flex-col gap-2.5 p-3">
      <div className="flex items-center gap-2">
        <InfoIcon className="text-primary size-5 shrink-0" />
        <p className="flex-1 font-medium">{m.decks_intro_title()}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onDismiss}
          aria-label={m.layout_intro_dismiss()}
          className="text-muted-foreground"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
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
      <p className="text-muted-foreground text-sm">
        {m.decks_intro_lead()}{" "}
        <TextLink render={<Link to="/help/$slug" params={{ slug: "deck-building" }} />}>
          {m.decks_intro_read_guide()}
        </TextLink>
      </p>
    </Callout>
  );
}

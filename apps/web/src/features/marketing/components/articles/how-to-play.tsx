import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { enumLabel } from "@openrift/shared/enum-label";
import { CoinsIcon, FlagIcon, SwordIcon, TimerIcon, TrophyIcon, ZapIcon } from "lucide-react";

import { Eyebrow, Heading } from "@/components/heading";
import { PROSE_MARKUP, linkMarkup } from "@/components/message-markup";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { DefinitionDetail, DefinitionList, DefinitionTerm } from "@/components/ui/definition-list";
import { TextLink } from "@/components/ui/text-link";
import { ArticleFeatureCard, StepRow } from "@/features/marketing/components/article-cards";
import { ZoneOverview } from "@/features/marketing/components/articles/zone-overview";
import { useEnumOrders } from "@/hooks/use-enums";
import { getFilterIconPath } from "@/lib/icons";
import { m } from "@/paraglide/messages.js";

const DOMAIN_FLAVORS: [string, () => string][] = [
  ["fury", m.help_how_to_play_domain_fury_flavor],
  ["calm", m.help_how_to_play_domain_calm_flavor],
  ["mind", m.help_how_to_play_domain_mind_flavor],
  ["body", m.help_how_to_play_domain_body_flavor],
  ["chaos", m.help_how_to_play_domain_chaos_flavor],
  ["order", m.help_how_to_play_domain_order_flavor],
];

export default function HowToPlayArticle() {
  const { labels } = useEnumOrders();
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">{m.help_how_to_play_intro()}</p>

      <Alert>
        <TrophyIcon className="text-warning" />
        <AlertTitle>{m.help_how_to_play_goal_title()}</AlertTitle>
        <AlertDescription>
          <ParaglideMessage message={m.help_how_to_play_goal} markup={PROSE_MARKUP} />
        </AlertDescription>
      </Alert>

      <section>
        <Heading className="mb-2">{m.help_how_to_play_bring_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_how_to_play_bring_intro()}</p>

        <div className="mt-3">
          <ZoneOverview
            descriptions={{
              legend: m.help_how_to_play_zone_legend_description(),
              champion: m.help_how_to_play_zone_champion_description(),
              battlefield: m.help_how_to_play_zone_battlefields_description(),
              runes: m.help_how_to_play_zone_runes_description(),
              main: m.help_how_to_play_zone_main_deck_description(),
            }}
          />
        </div>

        <p className="text-muted-foreground mt-3">
          <ParaglideMessage
            message={m.help_how_to_play_deck_builder}
            markup={{
              link: linkMarkup("/help/deck-building"),
            }}
          />
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_how_to_play_board_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage message={m.help_how_to_play_board} markup={PROSE_MARKUP} />
        </p>

        <Callout className="mt-3">
          <Eyebrow className="mb-3">{m.help_how_to_play_board_eyebrow()}</Eyebrow>
          <div className="bg-background flex h-56 items-center justify-center rounded-md">
            <span className="text-muted-foreground text-sm">
              {m.help_how_to_play_board_diagram()}
            </span>
          </div>
        </Callout>
      </section>

      <section>
        <Heading className="mb-2">{m.help_how_to_play_turn_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_how_to_play_turn_intro()}</p>

        <div className="mt-3 space-y-2">
          <StepRow
            step={1}
            title={m.help_how_to_play_step_start_title()}
            description={m.help_how_to_play_step_start_description()}
          />
          <StepRow
            step={2}
            title={m.help_how_to_play_step_action_title()}
            description={m.help_how_to_play_step_action_description()}
          />
          <StepRow
            step={3}
            title={m.help_how_to_play_step_end_title()}
            description={m.help_how_to_play_step_end_description()}
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_how_to_play_runes_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_how_to_play_runes_intro()}</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ArticleFeatureCard
            icon={<TimerIcon className="size-4" />}
            title={m.help_how_to_play_rune_exhaust_title()}
            description={m.help_how_to_play_rune_exhaust_description()}
          />
          <ArticleFeatureCard
            icon={<ZapIcon className="size-4" />}
            title={m.help_how_to_play_rune_return_title()}
            description={m.help_how_to_play_rune_return_description()}
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_how_to_play_battlefields_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_how_to_play_battlefields_intro()}</p>

        <DefinitionList className="text-muted-foreground mt-3">
          <DefinitionTerm icon={<FlagIcon className="text-success size-3.5" />}>
            {m.help_how_to_play_term_move_in()}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_how_to_play_term_move_in_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<SwordIcon className="text-destructive size-3.5" />}>
            {m.help_how_to_play_term_showdown()}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_how_to_play_term_showdown_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<TrophyIcon className="text-warning size-3.5" />}>
            {m.help_how_to_play_term_conquer()}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_how_to_play_term_conquer_detail()}</DefinitionDetail>
        </DefinitionList>
      </section>

      <section>
        <Heading className="mb-2">{m.help_how_to_play_domains_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_how_to_play_domains_intro()}</p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DOMAIN_FLAVORS.map(([domain, flavor]) => (
            <DomainTile
              key={domain}
              name={enumLabel(labels.domains, domain)}
              image={getFilterIconPath("domains", domain)}
              flavor={flavor()}
            />
          ))}
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_how_to_play_keywords_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_how_to_play_keywords_text()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_how_to_play_reading_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_how_to_play_reading_text()}</p>
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-dashed p-3">
          <CoinsIcon className="text-muted-foreground size-5" />
          <span className="text-muted-foreground text-sm">
            {m.help_how_to_play_reading_placeholder()}
          </span>
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_how_to_play_next_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_how_to_play_next_intro()}</p>
        <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1">
          <li>
            <TextLink
              href="https://riftbound.leagueoflegends.com/en-us/news/rules-and-releases/how-to-play-get-started/"
              target="_blank"
              rel="noreferrer"
            >
              {m.help_how_to_play_next_riot_link()}
            </TextLink>
          </li>
          <li>
            <TextLink
              href="https://riftboundguide.com/how-to-play-riftbound/"
              target="_blank"
              rel="noreferrer"
            >
              {m.help_how_to_play_next_guide_link()}
            </TextLink>
          </li>
          <li>
            <ParaglideMessage
              message={m.help_how_to_play_next_brew}
              markup={{
                link: linkMarkup("/help/deck-building"),
              }}
            />
          </li>
        </ul>
      </section>
    </div>
  );
}

function DomainTile({
  name,
  image,
  flavor,
}: {
  name: string;
  image: string | undefined;
  flavor: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <img src={image} alt="" className="size-8 shrink-0" />
        <div className="flex flex-col gap-1">
          <CardTitle>{name}</CardTitle>
          <CardDescription>{flavor}</CardDescription>
        </div>
      </CardContent>
    </Card>
  );
}

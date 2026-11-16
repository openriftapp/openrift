import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { enumLabel } from "@openrift/shared/enum-label";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import {
  CopyIcon,
  GripVerticalIcon,
  MousePointerClickIcon,
  PlusIcon,
  ShuffleIcon,
} from "lucide-react";

import { Eyebrow, Heading } from "@/components/heading";
import { PROSE_MARKUP, linkMarkup } from "@/components/message-markup";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Callout } from "@/components/ui/callout";
import { DefinitionDetail, DefinitionList, DefinitionTerm } from "@/components/ui/definition-list";
import { TextLink } from "@/components/ui/text-link";
import { ArticleFeatureCard, StepRow } from "@/features/marketing/components/article-cards";
import { ZoneOverview } from "@/features/marketing/components/articles/zone-overview";
import { useDeckFormatList, useZoneOrder } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

export default function DeckBuildingArticle() {
  const { zoneLabels } = useZoneOrder();
  const { labels: formatLabels } = useDeckFormatList();
  const zoneName = (zone: DeckZone) => enumLabel(zoneLabels, zone);
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">{m.help_deck_building_intro()}</p>

      <Alert>
        <AlertTitle>{m.help_deck_building_alert_title()}</AlertTitle>
        <AlertDescription>
          <p>
            <ParaglideMessage
              message={m.help_deck_building_alert_p1}
              markup={{
                link: linkMarkup("/help/cards-printings-copies"),
              }}
            />
          </p>
          <p>
            <ParaglideMessage
              message={m.help_deck_building_alert_p2}
              markup={{
                link: linkMarkup("/help/collections"),
                link2: ({ children }) => (
                  <TextLink href="/help/collections#deck-building-availability">
                    {children}
                  </TextLink>
                ),
              }}
            />
          </p>
        </AlertDescription>
      </Alert>

      <Callout>
        <Eyebrow className="mb-3">{m.help_deck_building_structure_eyebrow()}</Eyebrow>
        <ZoneOverview
          descriptions={{
            legend: m.help_deck_building_zone_legend_desc(),
            champion: m.help_deck_building_zone_champion_desc(),
            runes: m.help_deck_building_zone_runes_desc(),
            battlefield: m.help_deck_building_zone_battlefield_desc(),
            main: m.help_deck_building_zone_main_desc(),
            sideboard: m.help_deck_building_zone_sideboard_desc(),
          }}
        />
      </Callout>

      <section>
        <Heading className="mb-2">{m.help_deck_building_start_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_deck_building_start_p1_s1()}{" "}
          <strong className="text-foreground">{m.help_deck_building_start_p1_decks()}</strong>
          {m.help_deck_building_start_p1_s3()}{" "}
          <strong className="text-foreground">{m.help_deck_building_start_p1_new_deck()}</strong>
          {m.help_deck_building_start_p1_s5()}{" "}
          <strong className="text-foreground">
            {enumLabel(formatLabels, WellKnown.deckFormat.CONSTRUCTED)}
          </strong>
          {m.help_deck_building_start_p1_s7()}{" "}
          <strong className="text-foreground">
            {enumLabel(formatLabels, WellKnown.deckFormat.FREEFORM)}
          </strong>
          {m.help_deck_building_start_p1_s9()}
        </p>
        <p className="text-muted-foreground mt-2">
          {m.help_deck_building_start_p2_s1()}{" "}
          <strong className="text-foreground">{m.help_deck_building_start_p2_sidebar()}</strong>
          {m.help_deck_building_start_p2_s3()}{" "}
          <strong className="text-foreground">{m.help_deck_building_start_p2_browser()}</strong>
          {m.help_deck_building_start_p2_s5()}
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_deck_building_build_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_deck_building_build_intro()}</p>

        <div className="mt-3 space-y-2">
          <StepRow
            step={1}
            title={m.help_deck_building_build_step_1_title()}
            description={m.help_deck_building_build_step_1_desc()}
          />
          <StepRow
            step={2}
            title={m.help_deck_building_build_step_2_title()}
            description={m.help_deck_building_build_step_2_desc()}
          />
          <StepRow
            step={3}
            title={m.help_deck_building_build_step_3_title()}
            description={m.help_deck_building_build_step_3_desc()}
          />
          <StepRow
            step={4}
            title={m.help_deck_building_build_step_4_title()}
            description={m.help_deck_building_build_step_4_desc()}
          />
        </div>

        <p className="text-muted-foreground mt-3">{m.help_deck_building_build_outro()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_deck_building_add_heading()}</Heading>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ArticleFeatureCard
            icon={<PlusIcon className="size-4" />}
            title={m.help_deck_building_add_quick_title()}
            description={m.help_deck_building_add_quick_desc()}
          />
          <ArticleFeatureCard
            icon={<GripVerticalIcon className="size-4" />}
            title={m.help_deck_building_add_drag_title()}
            description={m.help_deck_building_add_drag_desc()}
          />
          <ArticleFeatureCard
            icon={<MousePointerClickIcon className="size-4" />}
            title={m.help_deck_building_add_quantity_title()}
            description={m.help_deck_building_add_quantity_desc()}
          />
          <ArticleFeatureCard
            icon={<ShuffleIcon className="size-4" />}
            title={m.help_deck_building_add_shift_title()}
            description={m.help_deck_building_add_shift_desc()}
          />
        </div>
        <p className="text-muted-foreground mt-3">
          <ParaglideMessage message={m.help_deck_building_add_overflow} markup={PROSE_MARKUP} />
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_deck_building_rules_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_deck_building_rules_intro()}</p>

        <DefinitionList className="text-muted-foreground mt-3">
          <DefinitionTerm icon={<TypeIcon src="/images/types/legend.svg" />}>
            {zoneName("legend")}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_deck_building_rules_legend_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<TypeIcon src="/images/supertypes/champion.svg" />}>
            {zoneName("champion")}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_deck_building_rules_champion_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<TypeIcon src="/images/types/rune.svg" />}>
            {zoneName("runes")}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_deck_building_rules_runes_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<TypeIcon src="/images/types/battlefield.svg" />}>
            {zoneName("battlefield")}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_deck_building_rules_battlefield_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<CopyIcon className="size-3.5" />}>
            {zoneName("main")}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_deck_building_rules_main_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<CopyIcon className="size-3.5" />}>
            {zoneName("sideboard")}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_deck_building_rules_sideboard_detail()}</DefinitionDetail>
        </DefinitionList>

        <p className="text-muted-foreground mt-3">{m.help_deck_building_rules_freeform()}</p>
        <p className="text-muted-foreground mt-2">{m.help_deck_building_rules_custom_region()}</p>
        <p className="text-muted-foreground mt-2">{m.help_deck_building_rules_infinity()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_deck_building_runes_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_deck_building_runes_body()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_deck_building_domain_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_deck_building_domain_body()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_deck_building_beta_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_deck_building_beta_intro()}</p>
        <p className="text-muted-foreground mt-2">{m.help_deck_building_beta_modes()}</p>
        <p className="text-muted-foreground mt-2">{m.help_deck_building_beta_rules()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_deck_building_stats_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_deck_building_stats_intro()}</p>
        <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1">
          <li>
            <strong className="text-foreground">{m.help_deck_building_stats_domain_label()}</strong>
            {m.help_deck_building_stats_domain_text()}
          </li>
          <li>
            <strong className="text-foreground">{m.help_deck_building_stats_curves_label()}</strong>
            {m.help_deck_building_stats_curves_text()}
          </li>
          <li>
            <strong className="text-foreground">{m.help_deck_building_stats_types_label()}</strong>
            {m.help_deck_building_stats_types_text()}
          </li>
        </ul>
      </section>

      <section>
        <Heading className="mb-2">{m.help_deck_building_manage_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage
            message={m.help_deck_building_manage_intro}
            markup={{
              link: ({ children }) => (
                <TextLink href="/decks">
                  <strong className="text-foreground">{children}</strong>
                </TextLink>
              ),
            }}
          />
        </p>
        <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1">
          <li>{m.help_deck_building_manage_open()}</li>
          <li>
            <strong className="text-foreground">
              {m.help_deck_building_manage_rename_label()}
            </strong>
            {m.help_deck_building_manage_rename_text()}
          </li>
          <li>
            <strong className="text-foreground">{m.help_deck_building_manage_clone_label()}</strong>
            {m.help_deck_building_manage_clone_text()}
          </li>
          <li>
            <strong className="text-foreground">{m.help_deck_building_manage_share_label()}</strong>
            {m.help_deck_building_manage_share_text()}
          </li>
          <li>
            <strong className="text-foreground">
              {m.help_deck_building_manage_export_label()}
            </strong>
            {m.help_deck_building_manage_export_text()}
          </li>
          <li>
            <strong className="text-foreground">{m.help_deck_building_manage_print_label()}</strong>
            {m.help_deck_building_manage_print_text()}
          </li>
          <li>
            <strong className="text-foreground">
              {m.help_deck_building_manage_delete_label()}
            </strong>
            {m.help_deck_building_manage_delete_text()}
          </li>
        </ul>
      </section>

      <section>
        <Heading className="mb-2">{m.help_deck_building_autosave_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_deck_building_autosave_body()}</p>
      </section>
    </div>
  );
}

function TypeIcon({ src }: { src: string }) {
  return <img src={src} alt="" className="size-3.5" />;
}

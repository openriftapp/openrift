import {
  CopyIcon,
  GripVerticalIcon,
  MousePointerClickIcon,
  PlusIcon,
  ShuffleIcon,
} from "lucide-react";

import { Eyebrow, Heading } from "@/components/heading";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Callout } from "@/components/ui/callout";
import { DefinitionDetail, DefinitionList, DefinitionTerm } from "@/components/ui/definition-list";
import { TextLink } from "@/components/ui/text-link";
import { FeatureCard, StepRow, ZoneCard } from "@/features/marketing/components/article-cards";
import { m } from "@/paraglide/messages.js";

export default function DeckBuildingArticle() {
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">{m.help_deck_building_intro()}</p>

      <Alert>
        <AlertTitle>{m.help_deck_building_alert_title()}</AlertTitle>
        <AlertDescription>
          <p>
            {m.help_deck_building_alert_p1_before()}{" "}
            <TextLink href="/help/cards-printings-copies">
              {m.help_deck_building_alert_p1_link()}
            </TextLink>
            {m.help_deck_building_alert_p1_after()}
          </p>
          <p>
            {m.help_deck_building_alert_p2_before()}{" "}
            <TextLink href="/help/collections">
              {m.help_deck_building_alert_p2_link_collections()}
            </TextLink>
            {m.help_deck_building_alert_p2_mid()}{" "}
            <TextLink href="/help/collections#deck-building-availability">
              {m.help_deck_building_alert_p2_link_available()}
            </TextLink>
            {m.help_deck_building_alert_p2_after()}
          </p>
        </AlertDescription>
      </Alert>

      <Callout>
        <Eyebrow>{m.help_deck_building_structure_eyebrow()}</Eyebrow>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <ZoneCard
            name="Legend"
            count="1"
            description={m.help_deck_building_zone_legend_desc()}
            color="text-warning"
          />
          <ZoneCard
            name="Chosen Champion"
            count="1"
            description={m.help_deck_building_zone_champion_desc()}
            color="text-violet"
          />
          <ZoneCard
            name="Runes"
            count="12"
            description={m.help_deck_building_zone_runes_desc()}
            color="text-info"
          />
          <ZoneCard
            name="Battlefield"
            count="3"
            description={m.help_deck_building_zone_battlefield_desc()}
            color="text-success"
          />
          <ZoneCard
            name="Main Deck"
            count="40"
            description={m.help_deck_building_zone_main_desc()}
            color="text-foreground"
          />
          <ZoneCard
            name="Sideboard"
            count="0–8"
            description={m.help_deck_building_zone_sideboard_desc()}
            color="text-muted-foreground"
          />
        </div>
      </Callout>

      <section>
        <Heading className="mb-2">{m.help_deck_building_start_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_deck_building_start_p1_s1()}{" "}
          <strong className="text-foreground">{m.help_deck_building_start_p1_decks()}</strong>
          {m.help_deck_building_start_p1_s3()}{" "}
          <strong className="text-foreground">{m.help_deck_building_start_p1_new_deck()}</strong>
          {m.help_deck_building_start_p1_s5()}{" "}
          <strong className="text-foreground">Constructed</strong>
          {m.help_deck_building_start_p1_s7()} <strong className="text-foreground">Freeform</strong>
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
          <FeatureCard
            icon={<PlusIcon className="size-4" />}
            title={m.help_deck_building_add_quick_title()}
            description={m.help_deck_building_add_quick_desc()}
          />
          <FeatureCard
            icon={<GripVerticalIcon className="size-4" />}
            title={m.help_deck_building_add_drag_title()}
            description={m.help_deck_building_add_drag_desc()}
          />
          <FeatureCard
            icon={<MousePointerClickIcon className="size-4" />}
            title={m.help_deck_building_add_quantity_title()}
            description={m.help_deck_building_add_quantity_desc()}
          />
          <FeatureCard
            icon={<ShuffleIcon className="size-4" />}
            title={m.help_deck_building_add_shift_title()}
            description={m.help_deck_building_add_shift_desc()}
          />
        </div>
        <p className="text-muted-foreground mt-3">
          {m.help_deck_building_add_overflow_before()}{" "}
          <strong className="text-foreground">Overflow</strong>
          {m.help_deck_building_add_overflow_after()}
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_deck_building_rules_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_deck_building_rules_intro()}</p>

        <DefinitionList className="text-muted-foreground mt-3">
          <DefinitionTerm icon={<TypeIcon src="/images/types/legend.svg" alt="Legend" />}>
            Legend
          </DefinitionTerm>
          <DefinitionDetail>{m.help_deck_building_rules_legend_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<TypeIcon src="/images/supertypes/champion.svg" alt="Champion" />}>
            Chosen Champion
          </DefinitionTerm>
          <DefinitionDetail>{m.help_deck_building_rules_champion_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<TypeIcon src="/images/types/rune.svg" alt="Rune" />}>
            Runes
          </DefinitionTerm>
          <DefinitionDetail>{m.help_deck_building_rules_runes_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<TypeIcon src="/images/types/battlefield.svg" alt="Battlefield" />}>
            Battlefield
          </DefinitionTerm>
          <DefinitionDetail>{m.help_deck_building_rules_battlefield_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<CopyIcon className="size-3.5" />}>Main</DefinitionTerm>
          <DefinitionDetail>{m.help_deck_building_rules_main_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<CopyIcon className="size-3.5" />}>Sideboard</DefinitionTerm>
          <DefinitionDetail>{m.help_deck_building_rules_sideboard_detail()}</DefinitionDetail>
        </DefinitionList>

        <p className="text-muted-foreground mt-3">{m.help_deck_building_rules_freeform()}</p>
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
          {m.help_deck_building_manage_intro_before()}{" "}
          <TextLink href="/decks">
            <strong className="text-foreground">Decks</strong>
          </TextLink>
          {m.help_deck_building_manage_intro_after()}
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

function TypeIcon({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} className="size-3.5" />;
}

import {
  CopyIcon,
  HandshakeIcon,
  HeartIcon,
  ListPlusIcon,
  PencilIcon,
  SquareIcon,
  SquareStackIcon,
  TagIcon,
  UploadIcon,
} from "lucide-react";

import { Heading } from "@/components/heading";
import { DefinitionDetail, DefinitionList, DefinitionTerm } from "@/components/ui/definition-list";
import { TextLink } from "@/components/ui/text-link";
import { FeatureCard, StepRow } from "@/features/marketing/components/article-cards";
import { m } from "@/paraglide/messages.js";

export default function ListsArticle() {
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">
        {m.help_lists_intro_before()}{" "}
        <strong className="text-foreground">{m.help_lists_intro_wishlist()}</strong>{" "}
        {m.help_lists_intro_mid()}{" "}
        <strong className="text-foreground">{m.help_lists_intro_tradelist()}</strong>{" "}
        {m.help_lists_intro_mid2()}{" "}
        <TextLink href="/help/groups">{m.help_lists_intro_group_link()}</TextLink>{" "}
        {m.help_lists_intro_after()}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <FeatureCard
          icon={<HeartIcon className="size-4" />}
          title={m.help_lists_card_wishlist_title()}
          description={m.help_lists_card_wishlist_desc()}
        />
        <FeatureCard
          icon={<HandshakeIcon className="size-4" />}
          title={m.help_lists_card_tradelist_title()}
          description={m.help_lists_card_tradelist_desc()}
        />
      </div>

      <section>
        <Heading className="mb-2">{m.help_lists_kinds_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_lists_kinds_p_before()}{" "}
          <strong className="text-foreground">{m.help_lists_kinds_p_kind()}</strong>
          {m.help_lists_kinds_p_mid()}{" "}
          <TextLink href="/help/cards-printings-copies">{m.help_lists_kinds_p_link()}</TextLink>{" "}
          {m.help_lists_kinds_p_after()}
        </p>
        <DefinitionList className="text-muted-foreground mt-3">
          <DefinitionTerm icon={<SquareIcon className="size-3.5" />}>
            {m.help_lists_kinds_cards_term()}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_lists_kinds_cards_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<CopyIcon className="size-3.5" />}>
            {m.help_lists_kinds_printings_term()}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_lists_kinds_printings_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<SquareStackIcon className="size-3.5" />}>
            {m.help_lists_kinds_copies_term()}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_lists_kinds_copies_detail()}</DefinitionDetail>
        </DefinitionList>
      </section>

      <section>
        <Heading className="mb-2">{m.help_lists_create_wishlist_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_lists_create_wishlist_p_before()}{" "}
          <strong className="text-foreground">{m.help_lists_collections_label()}</strong>{" "}
          {m.help_lists_create_wishlist_p_mid()}{" "}
          <strong className="text-foreground">{m.help_lists_new_wishlist_label()}</strong>.
        </p>
        <div className="mt-3 space-y-2">
          <StepRow
            step={1}
            title={m.help_lists_wishlist_step1_title()}
            description={m.help_lists_wishlist_step1_desc()}
          />
          <StepRow
            step={2}
            title={m.help_lists_wishlist_step2_title()}
            description={m.help_lists_wishlist_step2_desc()}
          />
          <StepRow
            step={3}
            title={m.help_lists_wishlist_step3_title()}
            description={m.help_lists_wishlist_step3_desc()}
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_lists_fill_wishlist_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_lists_fill_wishlist_p_before()}{" "}
          <strong className="text-foreground">{m.help_lists_browse_catalog_label()}</strong>{" "}
          {m.help_lists_fill_wishlist_p_mid()} <strong className="text-foreground">+</strong>{" "}
          {m.help_lists_fill_wishlist_p_after()}
        </p>
        <p className="text-muted-foreground mt-2">{m.help_lists_fill_wishlist_other_paths()}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={<ListPlusIcon className="size-4" />}
            title={m.help_lists_fill_catalog_title()}
            description={m.help_lists_fill_catalog_desc()}
          />
          <FeatureCard
            icon={<UploadIcon className="size-4" />}
            title={m.help_lists_fill_bulk_title()}
            description={
              <>
                {m.help_lists_fill_bulk_desc_before()}{" "}
                <TextLink href="/help/import-export">{m.help_lists_import_export_link()}</TextLink>{" "}
                {m.help_lists_fill_bulk_desc_after()}
              </>
            }
          />
          <FeatureCard
            icon={<PencilIcon className="size-4" />}
            title={m.help_lists_fill_deck_title()}
            description={m.help_lists_fill_deck_desc()}
          />
          <FeatureCard
            icon={<TagIcon className="size-4" />}
            title={m.help_lists_fill_drag_title()}
            description={m.help_lists_fill_drag_desc()}
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_lists_create_tradelist_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_lists_create_wishlist_p_before()}{" "}
          <strong className="text-foreground">{m.help_lists_collections_label()}</strong>{" "}
          {m.help_lists_create_wishlist_p_mid()}{" "}
          <strong className="text-foreground">{m.help_lists_new_tradelist_label()}</strong>.
        </p>
        <div className="mt-3 space-y-2">
          <StepRow
            step={1}
            title={m.help_lists_wishlist_step1_title()}
            description={m.help_lists_tradelist_step1_desc()}
          />
          <StepRow
            step={2}
            title={m.help_lists_tradelist_step2_title()}
            description={m.help_lists_tradelist_step2_desc()}
          />
          <StepRow
            step={3}
            title={m.help_lists_tradelist_step3_title()}
            description={m.help_lists_tradelist_step3_desc()}
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_lists_fill_tradelist_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_lists_fill_tradelist_p_before()}{" "}
          <TextLink href="/help/collections">{m.help_lists_collection_link()}</TextLink>{" "}
          {m.help_lists_fill_tradelist_p_after()}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={<ListPlusIcon className="size-4" />}
            title={m.help_lists_fill_from_collection_title()}
            description={m.help_lists_fill_from_collection_desc()}
          />
          <FeatureCard
            icon={<TagIcon className="size-4" />}
            title={m.help_lists_fill_drag_title()}
            description={m.help_lists_fill_tradelist_drag_desc()}
          />
        </div>
        <p className="text-muted-foreground mt-3">{m.help_lists_fill_tradelist_note()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_lists_prices_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_lists_prices_p_before()}{" "}
          <strong className="text-foreground">{m.help_lists_prices_them()}</strong>{" "}
          {m.help_lists_prices_mid()}{" "}
          <strong className="text-foreground">{m.help_lists_prices_you()}</strong>{" "}
          {m.help_lists_prices_after()}
        </p>

        <Heading level={3} className="mt-4 mb-2">
          {m.help_lists_defaults_heading()}
        </Heading>
        <p className="text-muted-foreground">
          {m.help_lists_defaults_p_before()}{" "}
          <strong className="text-foreground">{m.help_lists_edit_label()}</strong>{" "}
          {m.help_lists_defaults_p_after()}
        </p>
        <DefinitionList className="text-muted-foreground mt-3">
          <DefinitionTerm>{m.help_lists_defaults_price_term()}</DefinitionTerm>
          <DefinitionDetail>
            {m.help_lists_defaults_price_before()}{" "}
            <strong className="text-foreground">{m.help_lists_defaults_price_marketplace()}</strong>{" "}
            {m.help_lists_defaults_price_mid()}{" "}
            <strong className="text-foreground">{m.help_lists_defaults_price_fixed()}</strong>{" "}
            {m.help_lists_defaults_price_after()}
          </DefinitionDetail>
          <DefinitionTerm>{m.help_lists_defaults_currency_term()}</DefinitionTerm>
          <DefinitionDetail>{m.help_lists_defaults_currency_detail()}</DefinitionDetail>
          <DefinitionTerm>{m.help_lists_defaults_accepts_term()}</DefinitionTerm>
          <DefinitionDetail>
            <strong className="text-foreground">{m.help_lists_defaults_accepts_cards()}</strong>,{" "}
            <strong className="text-foreground">{m.help_lists_defaults_accepts_money()}</strong>,{" "}
            {m.help_lists_defaults_accepts_or()}{" "}
            <strong className="text-foreground">{m.help_lists_defaults_accepts_both()}</strong>.
          </DefinitionDetail>
        </DefinitionList>

        <Heading level={3} className="mt-4 mb-2">
          {m.help_lists_overrides_heading()}
        </Heading>
        <p className="text-muted-foreground">{m.help_lists_overrides_p()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_lists_quantities_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_lists_quantities_before()} <strong className="text-foreground">−</strong> /{" "}
          <strong className="text-foreground">+</strong> {m.help_lists_quantities_after()}
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_lists_filing_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_lists_filing_p1_before()}{" "}
          <strong className="text-foreground">{m.help_lists_filing_move_label()}</strong>{" "}
          {m.help_lists_filing_p1_mid1()}{" "}
          <strong className="text-foreground">{m.help_lists_filing_manage_label()}</strong>{" "}
          {m.help_lists_filing_p1_mid2()}{" "}
          <strong className="text-foreground">{m.help_lists_filing_select_all_label()}</strong>
          {m.help_lists_filing_p1_after()}
        </p>
        <p className="text-muted-foreground mt-2">{m.help_lists_filing_p2()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_lists_importing_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_lists_importing_p_before()}{" "}
          <TextLink href="/help/import-export">{m.help_lists_import_export_link()}</TextLink>{" "}
          {m.help_lists_importing_p_after()}
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_lists_sharing_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_lists_sharing_p_before()}{" "}
          <TextLink href="/help/groups">{m.help_lists_intro_group_link()}</TextLink>
          {m.help_lists_sharing_p_mid()}{" "}
          <strong className="text-foreground">{m.help_lists_sharing_settings_label()}</strong>
          {m.help_lists_sharing_p_after()}
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_lists_organize_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_lists_organize_p_before()}{" "}
          <strong className="text-foreground">{m.help_lists_organize_label()}</strong>{" "}
          {m.help_lists_organize_p_after()}
        </p>
      </section>
    </div>
  );
}

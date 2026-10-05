import { ParaglideMessage } from "@inlang/paraglide-js-react";
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
import { PROSE_MARKUP, linkMarkup } from "@/components/message-markup";
import { DefinitionDetail, DefinitionList, DefinitionTerm } from "@/components/ui/definition-list";
import { FeatureCard, StepRow } from "@/features/marketing/components/article-cards";
import { m } from "@/paraglide/messages.js";

export default function ListsArticle() {
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">
        <ParaglideMessage
          message={m.help_lists_intro}
          markup={{
            strong: PROSE_MARKUP.strong,
            strong2: PROSE_MARKUP.strong,
            link: linkMarkup("/help/groups"),
          }}
        />
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
          <ParaglideMessage
            message={m.help_lists_kinds_p}
            markup={{
              strong: PROSE_MARKUP.strong,
              link: linkMarkup("/help/cards-printings-copies"),
            }}
          />
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
          <ParaglideMessage
            message={m.help_lists_create_wishlist_p}
            inputs={{ action: m.help_lists_new_wishlist_label() }}
            markup={{
              strong: PROSE_MARKUP.strong,
              strong2: PROSE_MARKUP.strong,
            }}
          />
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
          <ParaglideMessage
            message={m.help_lists_fill_wishlist_p}
            markup={{
              strong: PROSE_MARKUP.strong,
              strong2: PROSE_MARKUP.strong,
            }}
          />
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
              <ParaglideMessage
                message={m.help_lists_fill_bulk_desc}
                markup={{
                  link: linkMarkup("/help/import-export"),
                }}
              />
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
          <ParaglideMessage
            message={m.help_lists_create_wishlist_p}
            inputs={{ action: m.help_lists_new_tradelist_label() }}
            markup={{
              strong: PROSE_MARKUP.strong,
              strong2: PROSE_MARKUP.strong,
            }}
          />
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
          <ParaglideMessage
            message={m.help_lists_fill_tradelist_p}
            markup={{
              link: linkMarkup("/help/collections"),
            }}
          />
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
          <ParaglideMessage
            message={m.help_lists_prices_p}
            markup={{
              strong: PROSE_MARKUP.strong,
              strong2: PROSE_MARKUP.strong,
            }}
          />
        </p>

        <Heading level={3} className="mt-4 mb-2">
          {m.help_lists_defaults_heading()}
        </Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage message={m.help_lists_defaults_p} markup={PROSE_MARKUP} />
        </p>
        <DefinitionList className="text-muted-foreground mt-3">
          <DefinitionTerm>{m.help_lists_defaults_price_term()}</DefinitionTerm>
          <DefinitionDetail>
            <ParaglideMessage
              message={m.help_lists_defaults_price}
              markup={{
                strong: PROSE_MARKUP.strong,
                strong2: PROSE_MARKUP.strong,
              }}
            />
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
          <ParaglideMessage
            message={m.help_lists_quantities}
            markup={{
              strong: PROSE_MARKUP.strong,
              strong2: PROSE_MARKUP.strong,
            }}
          />
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_lists_filing_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage
            message={m.help_lists_filing_p1}
            markup={{
              strong: PROSE_MARKUP.strong,
              strong2: PROSE_MARKUP.strong,
              strong3: PROSE_MARKUP.strong,
            }}
          />
        </p>
        <p className="text-muted-foreground mt-2">{m.help_lists_filing_p2()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_lists_importing_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage
            message={m.help_lists_importing_p}
            markup={{
              link: linkMarkup("/help/import-export"),
            }}
          />
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_lists_sharing_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage
            message={m.help_lists_sharing_p}
            markup={{
              link: linkMarkup("/help/groups"),
              strong: PROSE_MARKUP.strong,
            }}
          />
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_lists_organize_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage message={m.help_lists_organize_p} markup={PROSE_MARKUP} />
        </p>
      </section>
    </div>
  );
}

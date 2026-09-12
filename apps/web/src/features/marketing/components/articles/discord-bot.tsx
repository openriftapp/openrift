import {
  BookOpenTextIcon,
  CoinsIcon,
  LayoutGridIcon,
  MessageSquareTextIcon,
  SlashSquareIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Heading } from "@/components/heading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TextLink } from "@/components/ui/text-link";
import { FeatureCard, StepRow } from "@/features/marketing/components/article-cards";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { m } from "@/paraglide/messages.js";

export default function DiscordBotArticle() {
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">{m.help_discord_bot_intro()}</p>

      <section>
        <Heading className="mb-2">{m.help_discord_bot_add_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_discord_bot_add_intro_before()}{" "}
          <span className="font-medium">{m.help_discord_bot_add_intro_permission()}</span>{" "}
          {m.help_discord_bot_add_intro_after()}
        </p>
        <div className="mt-3 space-y-2">
          <StepRow
            step={1}
            title={m.help_discord_bot_step_1_title()}
            description={m.help_discord_bot_step_1_description()}
          />
          <StepRow
            step={2}
            title={m.help_discord_bot_step_2_title()}
            description={m.help_discord_bot_step_2_description()}
          />
          <StepRow
            step={3}
            title={m.help_discord_bot_step_3_title()}
            description={m.help_discord_bot_step_3_description()}
          />
        </div>
        <p className="mt-3">
          <TextLink
            className="font-medium"
            href={SOCIAL_LINKS.discordBotInvite}
            target="_blank"
            rel="noreferrer"
          >
            {m.help_discord_bot_invite_link()}
          </TextLink>
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_discord_bot_card_heading()}</Heading>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={<SlashSquareIcon className="size-4" />}
            title={m.help_discord_bot_card_name_title()}
            description={m.help_discord_bot_card_name_description()}
          />
          <FeatureCard
            icon={<MessageSquareTextIcon className="size-4" />}
            title={m.help_discord_bot_card_printing_title()}
            description={m.help_discord_bot_card_printing_description()}
          />
        </div>
        <p className="text-muted-foreground mt-3">
          {m.help_discord_bot_card_numbers_before()} <InlineCode>/card OGN-202</InlineCode>{" "}
          {m.help_discord_bot_card_numbers_mid()} <InlineCode>ogn202</InlineCode>
          {m.help_discord_bot_card_numbers_after()}
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_discord_bot_deck_heading()}</Heading>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={<SlashSquareIcon className="size-4" />}
            title={m.help_discord_bot_deck_code_title()}
            description={m.help_discord_bot_deck_code_description()}
          />
          <FeatureCard
            icon={<LayoutGridIcon className="size-4" />}
            title={m.help_discord_bot_deck_image_title()}
            description={m.help_discord_bot_deck_image_description()}
          />
        </div>
        <p className="text-muted-foreground mt-3">{m.help_discord_bot_deck_missing_cards()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_discord_bot_rule_heading()}</Heading>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={<SlashSquareIcon className="size-4" />}
            title={m.help_discord_bot_rule_number_title()}
            description={m.help_discord_bot_rule_number_description()}
          />
          <FeatureCard
            icon={<BookOpenTextIcon className="size-4" />}
            title={m.help_discord_bot_rule_sources_title()}
            description={m.help_discord_bot_rule_sources_description()}
          />
        </div>
        <p className="text-muted-foreground mt-3">
          {m.help_discord_bot_rule_inline_before()} <InlineCode>[[CR 103.1]]</InlineCode>{" "}
          {m.help_discord_bot_rule_inline_mid()} <InlineCode>[[103.1]]</InlineCode>{" "}
          {m.help_discord_bot_rule_inline_after()}
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_discord_bot_mention_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_discord_bot_mention_before()} <InlineCode>[[Doran&apos;s Shield]]</InlineCode>
          {m.help_discord_bot_mention_mid()} <InlineCode>[[OGN-202]]</InlineCode>{" "}
          {m.help_discord_bot_mention_after()}
        </p>
      </section>

      <Alert>
        <CoinsIcon className="size-4" />
        <AlertDescription>{m.help_discord_bot_prices_alert()}</AlertDescription>
      </Alert>
    </div>
  );
}

function InlineCode({ children }: { children: ReactNode }) {
  return <code className="bg-muted rounded-md px-1 py-0.5 font-mono text-sm">{children}</code>;
}

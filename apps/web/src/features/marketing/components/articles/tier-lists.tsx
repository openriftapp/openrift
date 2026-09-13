import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link } from "@tanstack/react-router";
import {
  GripVerticalIcon,
  ImageDownIcon,
  Link2Icon,
  ListOrderedIcon,
  MonitorPlayIcon,
  PencilIcon,
} from "lucide-react";

import { Heading } from "@/components/heading";
import { TextLink } from "@/components/ui/text-link";
import { FeatureCard } from "@/features/marketing/components/article-cards";
import { m } from "@/paraglide/messages.js";

export default function TierListsArticle() {
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">{m.help_tier_lists_intro()}</p>
      <p>
        <TextLink className="font-medium" render={<Link to="/tier-lists" />}>
          {m.help_tier_lists_open_link()}
        </TextLink>
      </p>

      <section>
        <Heading className="mb-2">{m.help_tier_lists_build_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_tier_lists_build_intro()}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={<GripVerticalIcon className="size-4" />}
            title={m.help_tier_lists_card_drag_title()}
            description={m.help_tier_lists_card_drag_description()}
          />
          <FeatureCard
            icon={<PencilIcon className="size-4" />}
            title={m.help_tier_lists_card_rename_title()}
            description={m.help_tier_lists_card_rename_description()}
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_tier_lists_share_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage
            message={m.help_tier_lists_share_intro}
            markup={{ strong: ({ children }) => <span className="font-medium">{children}</span> }}
          />
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={<Link2Icon className="size-4" />}
            title={m.help_tier_lists_card_share_title()}
            description={m.help_tier_lists_card_share_description()}
          />
          <FeatureCard
            icon={<ImageDownIcon className="size-4" />}
            title={m.help_tier_lists_card_download_title()}
            description={m.help_tier_lists_card_download_description()}
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_tier_lists_stream_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_tier_lists_stream_intro()}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={<MonitorPlayIcon className="size-4" />}
            title={m.help_tier_lists_card_present_title()}
            description={m.help_tier_lists_card_present_description()}
          />
          <FeatureCard
            icon={<ListOrderedIcon className="size-4" />}
            title={m.help_tier_lists_card_live_title()}
            description={m.help_tier_lists_card_live_description()}
          />
        </div>
        <p className="text-muted-foreground mt-3">
          <ParaglideMessage
            message={m.help_tier_lists_stage_link}
            markup={{
              link: ({ children }) => (
                <TextLink render={<Link to="/help/$slug" params={{ slug: "stage" }} />}>
                  {children}
                </TextLink>
              ),
            }}
          />
        </p>
      </section>
    </div>
  );
}

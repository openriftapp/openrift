import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightLeftIcon,
  Code2Icon,
  HammerIcon,
  HeartIcon,
  SproutIcon,
  ZapIcon,
} from "lucide-react";

import { Heading } from "@/components/heading";
import { DefinitionDetail, DefinitionList, DefinitionTerm } from "@/components/ui/definition-list";
import { TextLink } from "@/components/ui/text-link";
import { FeatureCard } from "@/features/marketing/components/article-cards";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { m } from "@/paraglide/messages.js";

export default function WhyOpenRiftArticle() {
  return (
    <div className="space-y-8">
      <section>
        <Heading className="mb-2">{m.help_why_openrift_exists_heading()}</Heading>
        <div className="text-muted-foreground space-y-3">
          <p>{m.help_why_openrift_exists_p1()}</p>
          <p>{m.help_why_openrift_exists_p2()}</p>
          <p>{m.help_why_openrift_exists_p3()}</p>
          <p>
            <ParaglideMessage
              message={m.help_why_openrift_exists_p4}
              markup={{
                link: ({ children }) => (
                  <TextLink render={<Link to="/roadmap" />}>{children}</TextLink>
                ),
              }}
            />
          </p>
          <p>
            <ParaglideMessage
              message={m.help_why_openrift_exists_p5}
              markup={{
                link: ({ children }) => (
                  <TextLink render={<Link to="/changelog" />}>{children}</TextLink>
                ),
              }}
            />
          </p>
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_why_openrift_what_heading()}</Heading>
        <div className="grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={<Code2Icon className="size-4" />}
            title={m.help_why_openrift_open_source_title()}
            description={
              <ParaglideMessage
                message={m.help_why_openrift_open_source}
                markup={{
                  link: ({ children }) => (
                    <TextLink href={SOCIAL_LINKS.githubRepo} target="_blank" rel="noreferrer">
                      {children}
                    </TextLink>
                  ),
                }}
              />
            }
          />
          <FeatureCard
            icon={<ArrowRightLeftIcon className="size-4" />}
            title={m.help_why_openrift_no_lock_in_title()}
            description={m.help_why_openrift_no_lock_in_description()}
          />
          <FeatureCard
            icon={<HeartIcon className="size-4" />}
            title={m.help_why_openrift_private_groups_title()}
            description={m.help_why_openrift_private_groups_description()}
          />
          <FeatureCard
            icon={<ZapIcon className="size-4" />}
            title={m.help_why_openrift_speed_title()}
            description={m.help_why_openrift_speed_description()}
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_why_openrift_gaps_heading()}</Heading>
        <p className="text-muted-foreground mb-3">{m.help_why_openrift_gaps_intro()}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FeatureCard
            variant="dashed"
            icon={<SproutIcon className="size-4" />}
            title={m.help_why_openrift_new_kid_title()}
            description={m.help_why_openrift_new_kid_description()}
          />
          <FeatureCard
            variant="dashed"
            icon={<HammerIcon className="size-4" />}
            title={m.help_why_openrift_less_time_title()}
            description={m.help_why_openrift_less_time_description()}
          />
        </div>
        <p className="text-muted-foreground mt-4 mb-2">{m.help_why_openrift_credit_intro()}</p>
        <ul className="text-muted-foreground list-disc space-y-1.5 pl-5">
          <li>
            <span className="text-foreground font-medium">Piltover Archive</span>{" "}
            {m.help_why_openrift_gap_piltover_text()}
          </li>
          <li>
            <span className="text-foreground font-medium">Riftbound.gg</span>{" "}
            {m.help_why_openrift_gap_riftbound_gg_text()}
          </li>
          <li>
            <span className="text-foreground font-medium">RiftCore</span>{" "}
            {m.help_why_openrift_gap_riftcore_text()}
          </li>
        </ul>
        <p className="text-muted-foreground mt-3">{m.help_why_openrift_gaps_outro()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_why_openrift_unique_heading()}</Heading>
        <p className="text-muted-foreground mb-3">
          <ParaglideMessage
            message={m.help_why_openrift_unique_intro}
            markup={{
              link: ({ children }) => (
                <TextLink render={<Link to="/features" />}>{children}</TextLink>
              ),
            }}
          />
        </p>
        <ul className="text-muted-foreground list-disc space-y-1.5 pl-5">
          <li>
            <span className="text-foreground font-medium">
              {m.help_why_openrift_unique_trade_label()}
            </span>{" "}
            {m.help_why_openrift_unique_trade_text()}
          </li>
          <li>
            <span className="text-foreground font-medium">
              {m.help_why_openrift_unique_group_collections_label()}
            </span>{" "}
            {m.help_why_openrift_unique_group_collections_text()}
          </li>
          <li>
            <span className="text-foreground font-medium">
              {m.help_why_openrift_unique_lending_label()}
            </span>{" "}
            {m.help_why_openrift_unique_lending_text()}
          </li>
          <li>
            <span className="text-foreground font-medium">
              {m.help_why_openrift_unique_deck_boxes_label()}
            </span>{" "}
            {m.help_why_openrift_unique_deck_boxes_text()}
          </li>
          <li>
            <span className="text-foreground font-medium">
              <TextLink render={<Link to="/help/$slug" params={{ slug: "browser-extension" }} />}>
                OpenRift Companion
              </TextLink>
              :
            </span>{" "}
            {m.help_why_openrift_unique_companion_text()}
          </li>
          <li>
            <span className="text-foreground font-medium">
              {m.help_why_openrift_unique_tournament_label()}
            </span>{" "}
            {m.help_why_openrift_unique_tournament_text()}
          </li>
          <li>
            <span className="text-foreground font-medium">
              {m.help_why_openrift_unique_match_tracker_label()}
            </span>{" "}
            {m.help_why_openrift_unique_match_tracker_text()}
          </li>
          <li>
            <span className="text-foreground font-medium">
              {m.help_why_openrift_unique_discord_label()}
            </span>{" "}
            <ParaglideMessage
              message={m.help_why_openrift_unique_discord}
              markup={{ code: ({ children }) => <span className="font-mono">{children}</span> }}
            />
          </li>
          <li>
            <span className="text-foreground font-medium">
              {m.help_why_openrift_unique_quick_entry_label()}
            </span>{" "}
            {m.help_why_openrift_unique_quick_entry_text()}
          </li>
          <li>
            <span className="text-foreground font-medium">
              {m.help_why_openrift_unique_completion_label()}
            </span>{" "}
            {m.help_why_openrift_unique_completion_text()}
          </li>
          <li>
            <span className="text-foreground font-medium">
              {m.help_why_openrift_unique_pack_opener_label()}
            </span>{" "}
            {m.help_why_openrift_unique_pack_opener_text()}
          </li>
          <li>
            <span className="text-foreground font-medium">
              {m.help_why_openrift_unique_designer_label()}
            </span>{" "}
            {m.help_why_openrift_unique_designer_text()}
          </li>
        </ul>
      </section>

      <section>
        <Heading className="mb-2">{m.help_why_openrift_tech_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_why_openrift_tech_intro()}</p>
        <DefinitionList className="mt-3">
          <DefinitionTerm>{m.help_why_openrift_tech_runtime()}</DefinitionTerm>
          <DefinitionDetail>
            <TechLink href="https://bun.com">Bun</TechLink>
          </DefinitionDetail>
          <DefinitionTerm>{m.help_why_openrift_tech_language()}</DefinitionTerm>
          <DefinitionDetail>
            <TechLink href="https://www.typescriptlang.org">TypeScript</TechLink>{" "}
            {m.help_why_openrift_tech_language_detail()}{" "}
            <TechLink href="https://oxc.rs">oxlint + oxfmt</TechLink>
          </DefinitionDetail>
          <DefinitionTerm>{m.help_why_openrift_tech_frontend()}</DefinitionTerm>
          <DefinitionDetail>
            <TechLink href="https://react.dev">React 19</TechLink>{" "}
            {m.help_why_openrift_tech_frontend_detail()}{" "}
            <TechLink href="https://vite.dev">Vite</TechLink>
          </DefinitionDetail>
          <DefinitionTerm>TanStack</DefinitionTerm>
          <DefinitionDetail>
            <TechLink href="https://tanstack.com/start">Start</TechLink>{" "}
            {m.help_why_openrift_tech_ssr_note()}{" "}
            <TechLink href="https://tanstack.com/router">Router</TechLink>,{" "}
            <TechLink href="https://tanstack.com/query">Query</TechLink>,{" "}
            <TechLink href="https://tanstack.com/db">DB</TechLink>,{" "}
            <TechLink href="https://tanstack.com/table">Table</TechLink>,{" "}
            <TechLink href="https://tanstack.com/virtual">Virtual</TechLink>,{" "}
            <TechLink href="https://tanstack.com/hotkeys">Hotkeys</TechLink>
          </DefinitionDetail>
          <DefinitionTerm>{m.help_why_openrift_tech_ui()}</DefinitionTerm>
          <DefinitionDetail>
            <TechLink href="https://tailwindcss.com">Tailwind CSS</TechLink> +{" "}
            <TechLink href="https://ui.shadcn.com">shadcn/ui</TechLink> +{" "}
            <TechLink href="https://base-ui.com">BaseUI</TechLink>{" "}
            {m.help_why_openrift_tech_ui_primitives()}
          </DefinitionDetail>
          <DefinitionTerm>{m.help_why_openrift_tech_state_forms()}</DefinitionTerm>
          <DefinitionDetail>
            <TechLink href="https://zustand.docs.pmnd.rs">Zustand</TechLink>,{" "}
            <TechLink href="https://react-hook-form.com">React Hook Form</TechLink>,{" "}
            <TechLink href="https://zod.dev">Zod</TechLink>
          </DefinitionDetail>
          <DefinitionTerm>{m.help_why_openrift_tech_backend()}</DefinitionTerm>
          <DefinitionDetail>
            <TechLink href="https://hono.dev">Hono</TechLink> +{" "}
            <TechLink href="https://orpc.unnoq.com">oRPC</TechLink> +{" "}
            <TechLink href="https://www.better-auth.com">better-auth</TechLink>
          </DefinitionDetail>
          <DefinitionTerm>{m.help_why_openrift_tech_database()}</DefinitionTerm>
          <DefinitionDetail>
            <TechLink href="https://www.postgresql.org">PostgreSQL</TechLink>{" "}
            {m.help_why_openrift_tech_database_via()}{" "}
            <TechLink href="https://kysely.dev">Kysely</TechLink>
          </DefinitionDetail>
          <DefinitionTerm>{m.help_why_openrift_tech_monorepo()}</DefinitionTerm>
          <DefinitionDetail>
            <TechLink href="https://turborepo.com">Turborepo</TechLink>{" "}
            {m.help_why_openrift_tech_monorepo_detail()}
          </DefinitionDetail>
          <DefinitionTerm>{m.help_why_openrift_tech_quality()}</DefinitionTerm>
          <DefinitionDetail>
            <TechLink href="https://vitest.dev">Vitest</TechLink> +{" "}
            <TechLink href="https://playwright.dev">Playwright</TechLink> +{" "}
            <TechLink href="https://sentry.io">Sentry</TechLink>
          </DefinitionDetail>
        </DefinitionList>
      </section>
    </div>
  );
}

function TechLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <TextLink href={href} target="_blank" rel="noreferrer">
      {children}
    </TextLink>
  );
}

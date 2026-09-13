import { ParaglideMessage } from "@inlang/paraglide-js-react";
import {
  BookOpenIcon,
  CrownIcon,
  FolderIcon,
  HandshakeIcon,
  HeartIcon,
  KeyIcon,
  ShieldIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";

import { Eyebrow, Heading } from "@/components/heading";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Callout } from "@/components/ui/callout";
import { DefinitionDetail, DefinitionList, DefinitionTerm } from "@/components/ui/definition-list";
import { TextLink } from "@/components/ui/text-link";
import { FeatureCard, StepRow } from "@/features/marketing/components/article-cards";
import { m } from "@/paraglide/messages.js";

export default function GroupsArticle() {
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">{m.help_groups_intro()}</p>

      <Callout>
        <Eyebrow>{m.help_groups_glance_eyebrow()}</Eyebrow>
        <div className="bg-background flex flex-col gap-3 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold">Tuesday Night Crew</span>
            <span className="bg-secondary text-secondary-foreground text-2xs rounded-full px-2 py-0.5 font-medium">
              {m.help_groups_roles_admin_term()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <SectionChip
              icon={<HandshakeIcon className="size-3.5" />}
              label={m.help_groups_glance_chip_matches()}
            />
            <SectionChip
              icon={<FolderIcon className="size-3.5" />}
              label={m.help_groups_glance_chip_group_collections()}
            />
            <SectionChip
              icon={<BookOpenIcon className="size-3.5" />}
              label={m.help_groups_glance_chip_personal_collections()}
            />
            <SectionChip
              icon={<UsersIcon className="size-3.5" />}
              label={m.help_groups_glance_chip_members()}
            />
            <SectionChip
              icon={<KeyIcon className="size-3.5" />}
              label={m.help_groups_glance_chip_settings()}
            />
          </div>
        </div>
      </Callout>

      <Alert>
        <ShieldIcon className="text-primary" />
        <AlertTitle>{m.help_groups_alert_title()}</AlertTitle>
        <AlertDescription>
          <p>{m.help_groups_alert_p1()}</p>
          <p>{m.help_groups_alert_p2()}</p>
        </AlertDescription>
      </Alert>

      <section>
        <Heading className="mb-2">{m.help_groups_roles_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_groups_roles_intro()}</p>
        <DefinitionList className="text-muted-foreground mt-3">
          <DefinitionTerm icon={<CrownIcon className="size-3.5" />}>
            {m.help_groups_roles_owner_term()}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_groups_roles_owner_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<ShieldIcon className="size-3.5" />}>
            {m.help_groups_roles_admin_term()}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_groups_roles_admin_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<UserIcon className="size-3.5" />}>
            {m.help_groups_roles_member_term()}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_groups_roles_member_detail()}</DefinitionDetail>
        </DefinitionList>
      </section>

      <section>
        <Heading className="mb-2">{m.help_groups_start_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_groups_start_p1_s1()}{" "}
          <strong className="text-foreground">{m.help_groups_start_p1_groups()}</strong>
          {m.help_groups_start_p1_s3()}{" "}
          <strong className="text-foreground">{m.help_groups_start_p1_new_group()}</strong>
          {m.help_groups_start_p1_s5()}
        </p>
        <div className="mt-3 space-y-2">
          <StepRow
            step={1}
            title={m.help_groups_start_step_1_title()}
            description={m.help_groups_start_step_1_desc()}
          />
          <StepRow
            step={2}
            title={m.help_groups_start_step_2_title()}
            description={m.help_groups_start_step_2_desc()}
          />
          <StepRow
            step={3}
            title={m.help_groups_start_step_3_title()}
            description={m.help_groups_start_step_3_desc()}
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_groups_join_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_groups_join_intro()}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={<KeyIcon className="size-4" />}
            title={m.help_groups_join_link_title()}
            description={m.help_groups_join_link_desc()}
          />
          <FeatureCard
            icon={<ShieldIcon className="size-4" />}
            title={m.help_groups_join_approval_title()}
            description={m.help_groups_join_approval_desc()}
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_groups_share_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage
            message={m.help_groups_share_intro}
            markup={{
              strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
            }}
          />
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <FeatureCard
            icon={<HeartIcon className="size-4" />}
            title={m.help_groups_share_wishlist_title()}
            description={m.help_groups_share_wishlist_desc()}
          />
          <FeatureCard
            icon={<HandshakeIcon className="size-4" />}
            title={m.help_groups_share_tradelist_title()}
            description={m.help_groups_share_tradelist_desc()}
          />
          <FeatureCard
            icon={<FolderIcon className="size-4" />}
            title={m.help_groups_share_organize_title()}
            description={m.help_groups_share_organize_desc()}
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_groups_matches_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_groups_matches_intro()}</p>
        <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1">
          <li>
            <strong className="text-foreground">{m.help_groups_matches_have_label()}</strong>
            {m.help_groups_matches_have_text()}
          </li>
          <li>
            <strong className="text-foreground">{m.help_groups_matches_want_label()}</strong>
            {m.help_groups_matches_want_text()}
          </li>
        </ul>
        <p className="text-muted-foreground mt-2">
          <ParaglideMessage
            message={m.help_groups_matches_p2}
            markup={{
              link: ({ children }) => (
                <TextLink href="/help/cards-printings-copies">{children}</TextLink>
              ),
            }}
          />
        </p>
        <p className="text-muted-foreground mt-2">
          <ParaglideMessage
            message={m.help_groups_matches_p3}
            markup={{ link: ({ children }) => <TextLink href="/trades">{children}</TextLink> }}
          />
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_groups_group_collections_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_groups_group_collections_p1()}</p>
        <p className="text-muted-foreground mt-2">
          <ParaglideMessage
            message={m.help_groups_group_collections_p2}
            markup={{
              link: ({ children }) => <TextLink href="/help/collections">{children}</TextLink>,
            }}
          />
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_groups_personal_collections_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage
            message={m.help_groups_personal_p1}
            markup={{
              strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
            }}
          />
        </p>
        <p className="text-muted-foreground mt-2">
          <ParaglideMessage
            message={m.help_groups_personal_p2}
            markup={{
              strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
            }}
          />
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_groups_members_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_groups_members_p1()}</p>
        <p className="text-muted-foreground mt-2">
          <ParaglideMessage
            message={m.help_groups_members_p2}
            markup={{
              strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
            }}
          />
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_groups_leaving_heading()}</Heading>
        <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1">
          <li>
            <strong className="text-foreground">{m.help_groups_leaving_leave_label()}</strong>
            {m.help_groups_leaving_leave_text()}
          </li>
          <li>
            <strong className="text-foreground">{m.help_groups_leaving_transfer_label()}</strong>
            {m.help_groups_leaving_transfer_text()}
          </li>
          <li>
            <strong className="text-foreground">{m.help_groups_leaving_delete_label()}</strong>
            {m.help_groups_leaving_delete_text()}
          </li>
        </ul>
      </section>
    </div>
  );
}

function SectionChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="bg-muted text-foreground flex items-center gap-1.5 rounded-md px-2 py-1 text-xs">
      <span className="text-muted-foreground">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

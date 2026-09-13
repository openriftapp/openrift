import { ParaglideMessage } from "@inlang/paraglide-js-react";
import {
  ArrowRightLeftIcon,
  BookOpenIcon,
  GripVerticalIcon,
  InboxIcon,
  KeyboardIcon,
  ListChecksIcon,
  MousePointerClickIcon,
  PackageIcon,
  PlusIcon,
  SearchIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";

import { Heading } from "@/components/heading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Callout } from "@/components/ui/callout";
import { DefinitionDetail, DefinitionList, DefinitionTerm } from "@/components/ui/definition-list";
import { TextLink } from "@/components/ui/text-link";
import { FeatureCard } from "@/features/marketing/components/article-cards";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export default function CollectionsArticle() {
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">{m.help_collections_intro()}</p>

      <Callout>
        <div className="flex flex-col gap-3 text-sm sm:flex-row">
          <div className="bg-background flex flex-col gap-1.5 rounded-lg p-3 sm:w-48">
            <span className="text-muted-foreground text-2xs mb-1 font-medium tracking-wide uppercase">
              {m.help_collections_mock_collections()}
            </span>
            <SidebarItem
              icon={<PackageIcon className="size-3.5" />}
              label={m.help_collections_mock_all_cards()}
              count={94}
            />
            <SidebarItem
              icon={<InboxIcon className="size-3.5" />}
              label={m.help_collections_mock_inbox()}
              count={12}
              active
            />
            <SidebarItem
              icon={<BookOpenIcon className="size-3.5" />}
              label={m.help_collections_mock_red_deck_box()}
              count={40}
            />
            <SidebarItem
              icon={<BookOpenIcon className="size-3.5" />}
              label={m.help_collections_mock_binder()}
              count={31}
            />
            <SidebarItem
              icon={<BookOpenIcon className="size-3.5" />}
              label={m.help_collections_mock_lent()}
              count={11}
            />
            <div className="border-border mt-1 border-t pt-1">
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <PlusIcon className="size-3" /> {m.help_collections_mock_new_collection()}
              </span>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="bg-muted flex-1 rounded-md px-2 py-1 text-xs">
                <SearchIcon className="text-muted-foreground mr-1 inline size-3" />
                <span className="text-muted-foreground">{m.help_collections_mock_search()}</span>
              </div>
              <div className="bg-primary/10 text-primary text-2xs rounded-md px-2 py-0.5 font-medium">
                {m.help_collections_mock_card_count()}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="bg-muted aspect-card rounded-md" />
              ))}
            </div>
          </div>
        </div>
      </Callout>

      <section>
        <Heading className="mb-2">{m.help_collections_physical_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_collections_physical_p1()}</p>
        <p className="text-muted-foreground mt-2">
          <ParaglideMessage
            message={m.help_collections_physical_p2}
            markup={{
              strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
              link: ({ children }) => (
                <TextLink href="/help/cards-printings-copies">{children}</TextLink>
              ),
            }}
          />
        </p>
      </section>

      <section>
        <Heading id="deck-building-availability" className="mb-2">
          {m.help_collections_availability_heading()}
        </Heading>
        <Alert>
          <ShieldCheckIcon className="text-primary" />
          <AlertDescription>
            <p>
              <ParaglideMessage
                message={m.help_collections_availability_p1}
                markup={{ em: ({ children }) => <em>{children}</em> }}
              />
            </p>
            <p>{m.help_collections_availability_p2()}</p>
          </AlertDescription>
        </Alert>
      </section>

      <section>
        <Heading className="mb-2">{m.help_collections_start_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage
            message={m.help_collections_start_p1}
            markup={{
              strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
              strong2: ({ children }) => <strong className="text-foreground">{children}</strong>,
            }}
          />
        </p>
        <p className="text-muted-foreground mt-2">
          <ParaglideMessage
            message={m.help_collections_start_p2}
            markup={{
              strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
            }}
          />
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_collections_adding_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_collections_adding_lead()}</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={<SearchIcon className="size-4" />}
            title={m.help_collections_adding_quick_title()}
            shortcut="Ctrl+K"
            description={m.help_collections_adding_quick_desc()}
          />
          <FeatureCard
            icon={<MousePointerClickIcon className="size-4" />}
            title={m.help_collections_adding_browse_title()}
            description={m.help_collections_adding_browse_desc()}
          />
          <FeatureCard
            icon={<KeyboardIcon className="size-4" />}
            title={m.help_collections_adding_several_title()}
            shortcut="1-9"
            description={m.help_collections_adding_several_desc()}
          />
        </div>

        <p className="text-muted-foreground mt-3">
          <ParaglideMessage
            message={m.help_collections_adding_done}
            markup={{
              strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
            }}
          />
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_collections_organizing_heading()}</Heading>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={<GripVerticalIcon className="size-4" />}
            title={m.help_collections_organizing_drag_title()}
            description={m.help_collections_organizing_drag_desc()}
          />
          <FeatureCard
            icon={<ListChecksIcon className="size-4" />}
            title={m.help_collections_organizing_bulk_title()}
            description={m.help_collections_organizing_bulk_desc()}
          />
          <FeatureCard
            icon={<ArrowRightLeftIcon className="size-4" />}
            title={m.help_collections_organizing_move_title()}
            description={m.help_collections_organizing_move_desc()}
          />
          <FeatureCard
            icon={<Trash2Icon className="size-4" />}
            title={m.help_collections_organizing_dispose_title()}
            description={m.help_collections_organizing_dispose_desc()}
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_collections_views_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_collections_views_p()}</p>
        <DefinitionList className="text-muted-foreground mt-3">
          <DefinitionTerm>{m.help_collections_views_cards_term()}</DefinitionTerm>
          <DefinitionDetail>{m.help_collections_views_cards_detail()}</DefinitionDetail>
          <DefinitionTerm>{m.help_collections_views_printings_term()}</DefinitionTerm>
          <DefinitionDetail>{m.help_collections_views_printings_detail()}</DefinitionDetail>
          <DefinitionTerm>{m.help_collections_views_copies_term()}</DefinitionTerm>
          <DefinitionDetail>{m.help_collections_views_copies_detail()}</DefinitionDetail>
        </DefinitionList>
      </section>

      <section>
        <Heading className="mb-2">{m.help_collections_sidebar_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage
            message={m.help_collections_sidebar_p1}
            markup={{
              strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
              strong2: ({ children }) => <strong className="text-foreground">{children}</strong>,
              strong3: ({ children }) => <strong className="text-foreground">{children}</strong>,
            }}
          />
        </p>
        <p className="text-muted-foreground mt-2">
          <ParaglideMessage
            message={m.help_collections_sidebar_p2}
            markup={{
              strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
              strong2: ({ children }) => <strong className="text-foreground">{children}</strong>,
            }}
          />
        </p>
      </section>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  count,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1 text-xs",
        active ? "bg-primary/10 text-primary font-medium" : "text-foreground",
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      <span
        className={cn(
          "text-2xs rounded-full px-1.5 tabular-nums",
          active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </div>
  );
}

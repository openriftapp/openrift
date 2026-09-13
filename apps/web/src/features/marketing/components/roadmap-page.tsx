import { Link } from "@tanstack/react-router";
import {
  ArrowRightLeftIcon,
  BanIcon,
  BotIcon,
  ClipboardListIcon,
  FileWarningIcon,
  FolderSyncIcon,
  Gamepad2Icon,
  GitBranchIcon,
  HandHeartIcon,
  HeartIcon,
  LanguagesIcon,
  LayersIcon,
  LibraryIcon,
  ListChecksIcon,
  MedalIcon,
  MonitorPlayIcon,
  PackageOpenIcon,
  PaletteIcon,
  PieChartIcon,
  PrinterIcon,
  RocketIcon,
  ScaleIcon,
  ScanLineIcon,
  ScrollTextIcon,
  Share2Icon,
  ShuffleIcon,
  SwordsIcon,
  TrophyIcon,
  UploadIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import {
  PageTopBar,
  PageTopBarActions,
  PageTopBarButton,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateLeaf } from "@/components/ui/date-leaf";
import { SectionHeading } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface RoadmapItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  done: boolean;
  date?: string;
}

function roadmapItems(): RoadmapItem[] {
  return [
    {
      title: m.marketing_roadmap_languages_title(),
      description: m.marketing_roadmap_languages_description(),
      icon: <LanguagesIcon className="size-4" />,
      done: true,
      date: "Sep 2026",
    },
    {
      title: m.marketing_roadmap_archive_title(),
      description: m.marketing_roadmap_archive_description(),
      icon: <TrophyIcon className="size-4" />,
      done: true,
      date: "Aug 2026",
    },
    {
      title: m.marketing_roadmap_streamer_title(),
      description: m.marketing_roadmap_streamer_description(),
      icon: <MonitorPlayIcon className="size-4" />,
      done: true,
      date: "Aug 2026",
    },
    {
      title: m.marketing_roadmap_discord_title(),
      description: m.marketing_roadmap_discord_description(),
      icon: <BotIcon className="size-4" />,
      done: true,
      date: "Aug 2026",
    },
    {
      title: m.marketing_roadmap_variants_title(),
      description: m.marketing_roadmap_variants_description(),
      icon: <GitBranchIcon className="size-4" />,
      done: true,
      date: "Aug 2026",
    },
    {
      title: m.marketing_roadmap_scanner_title(),
      description: m.marketing_roadmap_scanner_description(),
      icon: <ScanLineIcon className="size-4" />,
      done: true,
      date: "Aug 2026",
    },
    {
      title: m.marketing_roadmap_swiss_title(),
      description: m.marketing_roadmap_swiss_description(),
      icon: <SwordsIcon className="size-4" />,
      done: true,
      date: "Jul 2026",
    },
    {
      title: m.marketing_roadmap_lending_title(),
      description: m.marketing_roadmap_lending_description(),
      icon: <HandHeartIcon className="size-4" />,
      done: true,
      date: "Jul 2026",
    },
    {
      title: m.marketing_roadmap_condition_title(),
      description: m.marketing_roadmap_condition_description(),
      icon: <MedalIcon className="size-4" />,
      done: true,
      date: "Jul 2026",
    },
    {
      title: m.marketing_roadmap_tournament_tools_title(),
      description: m.marketing_roadmap_tournament_tools_description(),
      icon: <SwordsIcon className="size-4" />,
      done: true,
      date: "Jun 2026",
    },
    {
      title: m.marketing_roadmap_deck_plans_title(),
      description: m.marketing_roadmap_deck_plans_description(),
      icon: <ClipboardListIcon className="size-4" />,
      done: true,
      date: "Jun 2026",
    },
    {
      title: m.marketing_roadmap_tracker_title(),
      description: m.marketing_roadmap_tracker_description(),
      icon: <Gamepad2Icon className="size-4" />,
      done: true,
      date: "Jun 2026",
    },
    {
      title: m.marketing_roadmap_dynamic_lists_title(),
      description: m.marketing_roadmap_dynamic_lists_description(),
      icon: <ListChecksIcon className="size-4" />,
      done: true,
      date: "Jun 2026",
    },
    {
      title: m.marketing_roadmap_designer_title(),
      description: m.marketing_roadmap_designer_description(),
      icon: <PaletteIcon className="size-4" />,
      done: true,
      date: "Jun 2026",
    },
    {
      title: m.marketing_roadmap_groups_title(),
      description: m.marketing_roadmap_groups_description(),
      icon: <UsersIcon className="size-4" />,
      done: true,
      date: "May 2026",
    },
    {
      title: m.marketing_roadmap_trades_title(),
      description: m.marketing_roadmap_trades_description(),
      icon: <ArrowRightLeftIcon className="size-4" />,
      done: true,
      date: "May 2026",
    },
    {
      title: m.marketing_roadmap_lists_title(),
      description: m.marketing_roadmap_lists_description(),
      icon: <HeartIcon className="size-4" />,
      done: true,
      date: "May 2026",
    },
    {
      title: m.marketing_roadmap_rules_title(),
      description: m.marketing_roadmap_rules_description(),
      icon: <ScrollTextIcon className="size-4" />,
      done: true,
      date: "May 2026",
    },
    {
      title: m.marketing_roadmap_sharing_title(),
      description: m.marketing_roadmap_sharing_description(),
      icon: <Share2Icon className="size-4" />,
      done: true,
      date: "May 2026",
    },
    {
      title: m.marketing_roadmap_formats_title(),
      description: m.marketing_roadmap_formats_description(),
      icon: <ShuffleIcon className="size-4" />,
      done: true,
      date: "May 2026",
    },
    {
      title: m.marketing_roadmap_completion_title(),
      description: m.marketing_roadmap_completion_description(),
      icon: <PieChartIcon className="size-4" />,
      done: true,
      date: "Apr 2026",
    },
    {
      title: m.marketing_roadmap_bans_title(),
      description: m.marketing_roadmap_bans_description(),
      icon: <BanIcon className="size-4" />,
      done: true,
      date: "Apr 2026",
    },
    {
      title: m.marketing_roadmap_errata_title(),
      description: m.marketing_roadmap_errata_description(),
      icon: <FileWarningIcon className="size-4" />,
      done: true,
      date: "Apr 2026",
    },
    {
      title: m.marketing_roadmap_deck_io_title(),
      description: m.marketing_roadmap_deck_io_description(),
      icon: <FolderSyncIcon className="size-4" />,
      done: true,
      date: "Apr 2026",
    },
    {
      title: m.marketing_roadmap_collection_io_title(),
      description: m.marketing_roadmap_collection_io_description(),
      icon: <UploadIcon className="size-4" />,
      done: true,
      date: "Apr 2026",
    },
    {
      title: m.marketing_roadmap_pack_opener_title(),
      description: m.marketing_roadmap_pack_opener_description(),
      icon: <PackageOpenIcon className="size-4" />,
      done: true,
      date: "Apr 2026",
    },
    {
      title: m.marketing_roadmap_proxy_title(),
      description: m.marketing_roadmap_proxy_description(),
      icon: <PrinterIcon className="size-4" />,
      done: true,
      date: "Apr 2026",
    },
    {
      title: m.marketing_roadmap_deckbuilding_title(),
      description: m.marketing_roadmap_deckbuilding_description(),
      icon: <LayersIcon className="size-4" />,
      done: true,
      date: "Mar 2026",
    },
    {
      title: m.marketing_roadmap_collections_title(),
      description: m.marketing_roadmap_collections_description(),
      icon: <LibraryIcon className="size-4" />,
      done: true,
      date: "Mar 2026",
    },
    {
      title: m.marketing_roadmap_price_history_title(),
      description: m.marketing_roadmap_price_history_description(),
      icon: <WalletIcon className="size-4" />,
      done: true,
      date: "Mar 2026",
    },
    {
      title: m.marketing_roadmap_marketplaces_title(),
      description: m.marketing_roadmap_marketplaces_description(),
      icon: <ScaleIcon className="size-4" />,
      done: true,
      date: "Mar 2026",
    },
    {
      title: m.marketing_roadmap_accounts_title(),
      description: m.marketing_roadmap_accounts_description(),
      icon: <UsersIcon className="size-4" />,
      done: true,
      date: "Mar 2026",
    },
    {
      title: m.marketing_roadmap_launch_title(),
      description: m.marketing_roadmap_launch_description(),
      icon: <RocketIcon className="size-4" />,
      done: true,
      date: "Feb 2026",
    },
  ];
}

export function RoadmapPage() {
  const items = roadmapItems();

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{m.marketing_roadmap_title()}</PageTopBarTitle>
          <PageTopBarActions>
            <PageTopBarButton render={<Link to="/changelog" />}>
              {m.layout_header_whats_new()}
            </PageTopBarButton>
          </PageTopBarActions>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, "pt-3", PAGE_PADDING_NO_TOP)}>
        <p className="text-muted-foreground max-w-prose pb-4">
          {m.marketing_roadmap_intro_before()}{" "}
          <TextLink href={SOCIAL_LINKS.discordInvite} target="_blank" rel="noreferrer">
            Discord
          </TextLink>{" "}
          {m.marketing_roadmap_intro_or()}{" "}
          <TextLink href={SOCIAL_LINKS.githubIssues} target="_blank" rel="noreferrer">
            GitHub
          </TextLink>
          .
        </p>
        <ol className="relative">
          {items.map((item, i) => {
            const isFirst = i === 0;
            const isLast = i === items.length - 1;
            const firstDoneIndex = items.findIndex((r) => r.done);
            const isFirstDone = i === firstDoneIndex;

            const showHeader = (isFirst && !item.done) || isFirstDone;
            const headerLabel = isFirstDone
              ? m.marketing_roadmap_shipped()
              : m.marketing_roadmap_planned();

            return (
              <li key={item.title}>
                {showHeader && (
                  <div className="flex gap-4">
                    <div className="w-11 shrink-0" />
                    <SectionHeading className="flex-1 py-3">{headerLabel}</SectionHeading>
                  </div>
                )}
                <div className="flex gap-4">
                  <div className="flex w-11 shrink-0 flex-col items-center gap-2 self-stretch">
                    {item.done && item.date !== undefined ? (
                      <DateLeaf
                        month={item.date.slice(0, 3)}
                        caption={item.date.slice(-4)}
                        size="sm"
                      />
                    ) : (
                      <DateLeaf
                        month={m.marketing_roadmap_soon()}
                        size="sm"
                        className="text-muted-foreground border-dashed"
                      />
                    )}
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "w-px flex-1",
                          item.done && items[i + 1]?.done
                            ? "bg-border-accent/60"
                            : "bg-muted-foreground/15",
                        )}
                      />
                    )}
                  </div>

                  <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
                    <Card
                      size="sm"
                      className={cn(!item.done && "ring-muted-foreground/10 border-dashed")}
                    >
                      <CardHeader>
                        <CardTitle
                          className={cn(
                            "flex items-center gap-2",
                            item.done ? "text-foreground" : "text-muted-foreground italic",
                          )}
                        >
                          <span className={item.done ? "text-primary" : "text-muted-foreground/50"}>
                            {item.icon}
                          </span>
                          {item.title}
                        </CardTitle>
                        <CardDescription className={cn(!item.done && "italic")}>
                          {item.description}
                        </CardDescription>
                      </CardHeader>

                      <p
                        className={cn(
                          "px-3 pb-3 text-xs md:hidden",
                          item.done ? "text-muted-foreground" : "text-muted-foreground/60 italic",
                        )}
                      >
                        {item.done ? item.date : m.marketing_roadmap_soon_tm()}
                      </p>
                    </Card>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}

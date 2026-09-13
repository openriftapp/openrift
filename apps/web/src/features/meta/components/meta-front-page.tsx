import { dateLeafPartsUtc } from "@openrift/shared/format-date";
import type { MetaEventSummary } from "@openrift/shared/types/api/meta";
import type { MetaEventTier } from "@openrift/shared/types/enums";
import { Link, getRouteApi } from "@tanstack/react-router";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  LayersIcon,
  SwordsIcon,
  TrophyIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import {
  PageTopBar,
  PageTopBarActions,
  PageTopBarButton,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardLink } from "@/components/ui/card-link";
import { DateLeaf } from "@/components/ui/date-leaf";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { RowList } from "@/components/ui/row-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import { useIsAdmin } from "@/features/admin/hooks/use-admin";
import { MetaArchiveActivity } from "@/features/meta/components/meta-archive-activity";
import { MetaArchiveCounts } from "@/features/meta/components/meta-archive-counts";
import { MetaArchiveSearch } from "@/features/meta/components/meta-archive-search";
import { MetaContributeBand } from "@/features/meta/components/meta-contribute-band";
import { MetaEventRow } from "@/features/meta/components/meta-event-row";
import { MetaFrontEventBlock } from "@/features/meta/components/meta-front-event-block";
import { MetaScopeBar } from "@/features/meta/components/meta-scope-bar";
import { MetaUpcomingRow } from "@/features/meta/components/meta-upcoming-row";
import { useMetaActivity, useMetaCounts, useMetaEvents } from "@/features/meta/hooks/use-meta";
import { useMetaEras } from "@/features/meta/hooks/use-meta-eras";
import { useMetaSubmissions } from "@/features/meta/hooks/use-meta-submissions";
import {
  filterMetaEvents,
  metaEventCountries,
  metaFrontSections,
} from "@/features/meta/lib/meta-front-page";
import type { MetaScope } from "@/features/meta/lib/meta-scope";
import {
  CLEARED_SCOPE,
  isScopeCustomized,
  nextScopeSearch,
  resolveScopeRange,
  UNSCOPED,
} from "@/features/meta/lib/meta-scope";
import { useUserId } from "@/lib/auth-session";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/meta");

function archiveIndexes() {
  return [
    {
      to: "/meta/decks",
      icon: LayersIcon,
      title: m.meta_front_tile_decklists_title(),
      description: m.meta_front_tile_decklists_description(),
    },
    {
      to: "/meta/legends",
      icon: SwordsIcon,
      title: m.meta_front_tile_legends_title(),
      description: m.meta_front_tile_legends_description(),
    },
  ] as const;
}

const PREMIER_LIMIT = 3;
const COMPETITIVE_LIMIT = 4;
const LOCAL_LIMIT = 5;
const UPCOMING_LIMIT = 6;

/** Hidden for a signed-in visitor who has never contributed, so the link is never to an empty page. */
function ContributionsLink() {
  const { data } = useMetaSubmissions();
  const hasSubmissions = data?.pages.some((page) => page.items.length > 0) === true;
  if (!hasSubmissions) {
    return null;
  }
  return (
    <PageTopBarButton render={<Link to="/meta/submissions" />}>
      {m.meta_submissions_title()}
    </PageTopBarButton>
  );
}

function ArchiveIndexTiles() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {archiveIndexes().map((index) => (
        <CardLink key={index.to} render={<Link to={index.to} />} size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <index.icon className="text-muted-foreground size-4" />
              {index.title}
              <ChevronRightIcon aria-hidden className="text-muted-foreground ml-auto size-4" />
            </CardTitle>
            <CardDescription>{index.description}</CardDescription>
          </CardHeader>
        </CardLink>
      ))}
    </div>
  );
}

function MetaEmptyState() {
  const { data: isAdmin } = useIsAdmin();
  return (
    <EmptyState
      className="py-12"
      icon={TrophyIcon}
      title={m.meta_front_empty_title()}
      description={m.meta_front_empty_description()}
    >
      {isAdmin === true && (
        <Button render={<Link to="/admin/meta" />}>{m.meta_front_add_event()}</Button>
      )}
    </EmptyState>
  );
}

function Section({
  id,
  title,
  action,
  accent,
  children,
}: {
  id?: string;
  title: string;
  action?: ReactNode;
  accent?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-[calc(var(--header-height)+0.75rem)] flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {accent !== undefined && (
          <span aria-hidden="true" className={cn("h-4 w-1 self-center rounded-full", accent)} />
        )}
        <SectionHeading variant="display">{title}</SectionHeading>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Clears the index's default era and format, or the shown count lands short of `count`. */
function TierIndexLink({ tiers, count }: { tiers: MetaEventTier[]; count: number }) {
  return (
    <TextLink
      className="text-sm font-medium"
      render={<Link to="/meta/events" search={{ ...UNSCOPED, tiers }} />}
    >
      {m.meta_front_browse_all({ count: String(count) })}
    </TextLink>
  );
}

function UpcomingTeaser({ next, count }: { next: MetaEventSummary; count: number }) {
  const leaf = dateLeafPartsUtc(next.eventDate);

  return (
    <div className="lg:hidden">
      <Link
        from="/meta"
        search={(prev) => prev}
        hash="coming-up"
        hashScrollIntoView
        className="hover:bg-muted/50 focus-visible:ring-ring/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 outline-none focus-visible:ring-2"
      >
        <DateLeaf month={leaf.month} day={leaf.day} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">
            <span className="font-semibold">{m.meta_front_next_up()}</span>
            <span className="text-muted-foreground"> · </span>
            {next.name}
          </span>
          <span className="text-muted-foreground text-xs">{m.meta_front_upcoming({ count })}</span>
        </span>
        <ChevronDownIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
      </Link>
    </div>
  );
}

/** Nothing here rates a deck, a card, or a legend against another. */
export function MetaFrontPage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const userId = useUserId();
  const eras = useMetaEras();
  const { data: eventsData } = useMetaEvents(resolveScopeRange(search, eras));
  const { data: counts } = useMetaCounts();
  const { data: activityData } = useMetaActivity();

  const setScope = (patch: Partial<MetaScope>) => {
    void navigate({ search: (prev) => nextScopeSearch(prev, patch) });
  };
  const clearScope = () => {
    void navigate({ search: (prev) => nextScopeSearch({ ...prev, q: undefined }, CLEARED_SCOPE) });
  };
  const setQuery = (next: string) => {
    void navigate({ search: (prev) => nextScopeSearch({ ...prev, q: next }, {}) });
  };

  const fetchedEvents = eventsData.events;
  const events = filterMetaEvents(fetchedEvents, { scope: search, eras, search: search.q });
  const sections = metaFrontSections(events);
  const hasResults =
    sections.premier.length > 0 || sections.competitive.length > 0 || sections.local.length > 0;
  const playerResults = events.reduce((total, event) => total + event.playerRowCount, 0);
  const deckResults = events.reduce((total, event) => total + event.deckCount, 0);
  const showActivity = !isScopeCustomized(search) && (search.q ?? "").trim() === "";
  const hasRail = sections.upcoming.length > 0 || (showActivity && activityData.items.length > 0);
  const nextUpcoming = sections.upcoming.at(0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{m.meta_front_title()}</PageTopBarTitle>
          <PageTopBarActions>{userId !== null && <ContributionsLink />}</PageTopBarActions>
        </PageTopBar>
      </PageTopBarSticky>

      <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-8 pt-3 pb-10")}>
        {counts.totalEvents === 0 ? (
          <MetaEmptyState />
        ) : (
          <>
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-2">
                <MetaArchiveSearch value={search.q ?? ""} onCommit={setQuery} />
                <MetaScopeBar
                  scope={search}
                  setScope={setScope}
                  clearScope={clearScope}
                  eras={eras}
                  countries={metaEventCountries(fetchedEvents)}
                  showTier={false}
                />
              </div>
              <MetaArchiveCounts
                eventCount={events.length}
                playerResultCount={playerResults}
                deckCount={deckResults}
              />
              <ArchiveIndexTiles />
            </div>

            {events.length === 0 ? (
              <>
                <Empty>
                  <EmptyHeader>
                    <EmptyDescription>{m.meta_front_no_match()}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
                <MetaContributeBand />
              </>
            ) : (
              <>
                {nextUpcoming && (
                  <UpcomingTeaser next={nextUpcoming} count={sections.upcoming.length} />
                )}

                <div
                  className={cn(
                    "flex flex-col gap-8",
                    hasRail &&
                      "lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-x-8",
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-8">
                    {hasResults ? (
                      <>
                        {sections.premier.length > 0 && (
                          <Section
                            title={m.meta_event_tier_premier()}
                            accent="bg-border-accent"
                            action={
                              <TierIndexLink
                                tiers={["premier"]}
                                count={counts.eventsByTier.premier}
                              />
                            }
                          >
                            <RowList>
                              {sections.premier.slice(0, PREMIER_LIMIT).map((event) => (
                                <li key={event.id}>
                                  <MetaFrontEventBlock event={event} />
                                </li>
                              ))}
                            </RowList>
                          </Section>
                        )}

                        {sections.competitive.length > 0 && (
                          <Section
                            title={m.meta_event_tier_competitive()}
                            accent="bg-primary"
                            action={
                              <TierIndexLink
                                tiers={["competitive"]}
                                count={counts.eventsByTier.competitive}
                              />
                            }
                          >
                            <RowList>
                              {sections.competitive.slice(0, COMPETITIVE_LIMIT).map((event) => (
                                <li key={event.id}>
                                  <MetaFrontEventBlock event={event} />
                                </li>
                              ))}
                            </RowList>
                          </Section>
                        )}

                        {sections.local.length > 0 && (
                          <Section
                            title={m.meta_event_tier_local()}
                            accent="bg-muted-foreground/40"
                            action={
                              <TextLink
                                className="text-sm font-medium"
                                render={<Link to="/meta/events" search={UNSCOPED} />}
                              >
                                {m.meta_front_browse_all_events({
                                  count: String(counts.totalEvents),
                                })}
                              </TextLink>
                            }
                          >
                            <RowList>
                              {sections.local.slice(0, LOCAL_LIMIT).map((event) => (
                                <li key={event.id}>
                                  <MetaEventRow event={event} />
                                </li>
                              ))}
                            </RowList>
                          </Section>
                        )}
                      </>
                    ) : (
                      <Empty>
                        <EmptyHeader>
                          <EmptyDescription>{m.meta_front_scope_empty()}</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )}
                  </div>

                  {hasRail && (
                    <aside className="flex flex-col gap-8 lg:sticky lg:top-[calc(var(--header-height)+0.75rem)] lg:col-start-2 lg:row-span-2 lg:row-start-1">
                      {sections.upcoming.length > 0 && (
                        <Section
                          id="coming-up"
                          title={m.meta_front_coming_up()}
                          action={
                            <TextLink
                              className="text-sm font-medium"
                              render={
                                <Link
                                  to="/meta/events"
                                  search={{ ...search, holds: "upcoming", by: "date", dir: "asc" }}
                                />
                              }
                            >
                              {m.meta_front_all_n({ count: String(sections.upcoming.length) })}
                            </TextLink>
                          }
                        >
                          <RowList>
                            {sections.upcoming.slice(0, UPCOMING_LIMIT).map((event) => (
                              <li key={event.id}>
                                <MetaUpcomingRow event={event} />
                              </li>
                            ))}
                          </RowList>
                        </Section>
                      )}

                      {showActivity && activityData.items.length > 0 && (
                        <Section title={m.meta_front_fresh()}>
                          <MetaArchiveActivity items={activityData.items} />
                        </Section>
                      )}
                    </aside>
                  )}

                  <div className="lg:col-start-1">
                    <MetaContributeBand />
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

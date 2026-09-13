import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { ChangelogEntry, ChangelogGroup } from "@openrift/shared/changelog";
import { parseChangelog } from "@openrift/shared/changelog";
import { dateLeafPartsUtc, formatRelativeDay } from "@openrift/shared/format-date";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";

import changelogMd from "@/CHANGELOG.md?raw";
import {
  PageTopBar,
  PageTopBarActions,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DateLeaf } from "@/components/ui/date-leaf";
import { TextLink } from "@/components/ui/text-link";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ChangelogView } from "@/features/marketing/lib/changelog-search-schema";
import { MilestoneIcon } from "@/features/marketing/lib/milestone-icons";
import { DATE_WORDS } from "@/lib/date-words";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const changelogGroups = parseChangelog(changelogMd);
const milestones = changelogGroups.flatMap((group) =>
  group.milestone === undefined ? [] : [{ date: group.date, entry: group.milestone }],
);

function SkewedBadge({ text, color }: { text: string; color: string }) {
  return (
    <span className="relative ml-1 inline-flex w-10 shrink-0 justify-center py-0.5">
      <span className={`absolute inset-0 -skew-x-[15deg] ${color}`} />
      <span className="relative -ml-0.5 text-sm leading-none font-semibold tracking-tight text-white uppercase italic">
        {text}
      </span>
    </span>
  );
}

function EntryItem({ entry }: { entry: ChangelogEntry }) {
  return (
    <li className="flex items-baseline gap-2 text-sm">
      <SkewedBadge
        text={entry.type}
        color={entry.type === "feat" ? "bg-[#24705f]" : "bg-[#cd346f]"}
      />
      <span>
        {entry.area && (
          <span className="bg-muted text-muted-foreground text-2xs mr-1.5 rounded-md px-1.5 py-0.5 font-medium tracking-wide whitespace-nowrap uppercase">
            {entry.area}
          </span>
        )}
        {entry.title ? (
          <>
            <span className="font-semibold">{entry.title}:</span>
            <span className="text-muted-foreground"> {entry.message}</span>
          </>
        ) : (
          entry.message
        )}
      </span>
    </li>
  );
}

function MilestoneCard({ entry }: { entry: ChangelogEntry }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MilestoneIcon token={entry.icon} className="text-primary size-4" />
          {entry.title}
        </CardTitle>
        <CardDescription>{entry.message}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function TimelineRow({
  date,
  isLast,
  children,
}: {
  date: string;
  isLast: boolean;
  children: React.ReactNode;
}) {
  const leaf = dateLeafPartsUtc(`${date}T00:00:00Z`, DATE_WORDS);
  return (
    <li id={date} className="flex scroll-mt-32 gap-4">
      <div className="flex w-11 shrink-0 flex-col items-center gap-2 self-stretch">
        {/* <time> keeps the ISO day machine-readable (assistive tech, feed
            readers, the e2e test) while the leaf shows the parts. */}
        <time dateTime={date} title={formatRelativeDay(date, undefined, DATE_WORDS)}>
          <DateLeaf month={leaf.month} day={leaf.day} caption={leaf.year} size="sm" />
        </time>
        {!isLast && <span aria-hidden="true" className="bg-border-accent/60 w-px flex-1" />}
      </div>
      <div className={cn("min-w-0 flex-1 pb-6", isLast && "pb-0")}>{children}</div>
    </li>
  );
}

function DayGroup({ group }: { group: ChangelogGroup }) {
  return (
    <>
      {group.milestone && <MilestoneCard entry={group.milestone} />}
      {group.highlights.length > 0 && (
        <ul className={cn("space-y-2", group.milestone && "pt-3")}>
          {group.highlights.map((entry, i) => (
            <EntryItem key={i} entry={entry} />
          ))}
        </ul>
      )}
      {group.other.length > 0 && (
        <Collapsible
          defaultOpen={group.highlights.length === 0}
          className={cn((group.highlights.length > 0 || group.milestone) && "pt-2")}
        >
          {group.highlights.length > 0 && (
            <CollapsibleTrigger className="group text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-sm">
              <ChevronRightIcon className="size-3.5 transition-transform group-data-[panel-open]:rotate-90" />
              {m.marketing_changelog_more({ count: group.other.length })}
            </CollapsibleTrigger>
          )}
          <CollapsibleContent>
            <ul className="space-y-2 pt-2">
              {group.other.map((entry, i) => (
                <EntryItem key={i} entry={entry} />
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </>
  );
}

function MilestoneTimeline() {
  return (
    <ol className="relative">
      {milestones.map(({ date, entry }, i) => (
        <TimelineRow key={date} date={date} isLast={i === milestones.length - 1}>
          <Link
            to="/changelog"
            hash={date}
            className="block rounded-lg outline-none focus-visible:ring-2"
          >
            <MilestoneCard entry={entry} />
          </Link>
        </TimelineRow>
      ))}
    </ol>
  );
}

function EverythingTimeline() {
  return (
    <ol className="relative">
      {changelogGroups.map((group, i) => (
        <TimelineRow key={group.date} date={group.date} isLast={i === changelogGroups.length - 1}>
          <DayGroup group={group} />
        </TimelineRow>
      ))}
    </ol>
  );
}

export function ChangelogPage({ view }: { view: ChangelogView }) {
  const navigate = useNavigate();

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{m.layout_header_whats_new()}</PageTopBarTitle>
          <PageTopBarActions>
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={0}
              value={[view]}
              onValueChange={([next]) => {
                if (next === "everything" || next === "milestones") {
                  void navigate({
                    to: "/changelog",
                    search: next === "milestones" ? { show: next } : {},
                    replace: true,
                  });
                }
              }}
            >
              <ToggleGroupItem value="everything">
                {m.marketing_changelog_view_everything()}
              </ToggleGroupItem>
              <ToggleGroupItem value="milestones">
                {m.marketing_changelog_view_milestones()}
              </ToggleGroupItem>
            </ToggleGroup>
          </PageTopBarActions>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, "pt-3", PAGE_PADDING_NO_TOP)}>
        <p className="text-muted-foreground pb-4">
          <ParaglideMessage
            message={m.marketing_changelog_intro}
            markup={{
              link: ({ children }) => (
                <TextLink href={SOCIAL_LINKS.discordInvite} target="_blank" rel="noreferrer">
                  {children}
                </TextLink>
              ),
              link2: ({ children }) => (
                <TextLink href={SOCIAL_LINKS.githubIssues} target="_blank" rel="noreferrer">
                  {children}
                </TextLink>
              ),
            }}
          />
        </p>
        {view === "milestones" ? <MilestoneTimeline /> : <EverythingTimeline />}
      </div>
    </>
  );
}

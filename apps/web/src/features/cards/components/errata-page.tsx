import { formatDay, formatMonthYear } from "@openrift/shared/format-date";
import { imageUrl } from "@openrift/shared/image-url";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRightIcon, SearchXIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Heading } from "@/components/heading";
import { PageHero, PageHeroCardFan } from "@/components/layout/page-hero";
import { Button } from "@/components/ui/button";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ErrataView } from "@/features/cards/components/errata-entry";
import { ErrataEntry } from "@/features/cards/components/errata-entry";
import { SearchInput } from "@/features/cards/components/search-input";
import type { ErrataGroup } from "@/features/cards/lib/errata-list";
import {
  countErrataBySet,
  errataGroupIdForCard,
  groupErrata,
  latestErrataUpdate,
} from "@/features/cards/lib/errata-list";
import { errataListQueryOptions } from "@/features/cards/lib/errata-queries";
import { DATE_WORDS } from "@/lib/date-words";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const ALL_SETS = "all";

function isErrataView(value: unknown): value is ErrataView {
  return value === "side" || value === "inline";
}

function groupTitle(group: ErrataGroup): string {
  return group.announcement?.name ?? m.errata_unannounced_title();
}

function groupShortTitle(group: ErrataGroup): string {
  if (group.announcement === null) {
    return m.errata_unannounced_title();
  }
  return group.announcement.name.replace(/ (?:Card )?Errata(?: Updates?)?$/u, "");
}

function GroupNav({ groups }: { groups: ErrataGroup[] }) {
  return (
    <nav
      aria-label={m.errata_toc_heading()}
      className="min-w-0 lg:sticky lg:top-[calc(var(--header-height)+1rem)] lg:self-start"
    >
      <p className="text-muted-foreground mb-2 hidden text-xs font-semibold tracking-wide uppercase lg:block">
        {m.errata_toc_heading()}
      </p>
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible">
        {groups.map((group) => (
          <li key={group.id} className="shrink-0">
            <a
              href={`#${group.id}`}
              className={cn(
                "hover:bg-muted flex items-baseline justify-between gap-3 rounded-md px-2.5 py-1.5 whitespace-nowrap",
                group.entries.length === 0 && "opacity-50",
              )}
            >
              <span className="flex flex-col">
                <span className="text-sm font-medium">{groupShortTitle(group)}</span>
                <span className="text-muted-foreground text-xs">
                  {group.announcement === null
                    ? m.errata_unannounced_short()
                    : formatMonthYear(group.announcement.publishedOn, DATE_WORDS)}
                </span>
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {group.entries.length}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function GroupSection({
  group,
  open,
  onToggle,
  view,
}: {
  group: ErrataGroup;
  open: boolean;
  onToggle: () => void;
  view: ErrataView;
}) {
  const headingId = `${group.id}-heading`;
  const listId = `${group.id}-list`;
  const { announcement } = group;
  return (
    <section id={group.id} aria-labelledby={headingId} className="scroll-mt-40">
      <div className="border-foreground flex flex-wrap items-end justify-between gap-3 border-b-2 pb-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-warning text-xs font-semibold tracking-wide uppercase">
            {announcement === null
              ? m.errata_unannounced_eyebrow()
              : formatMonthYear(announcement.publishedOn, DATE_WORDS)}
          </p>
          <Heading id={headingId}>{groupTitle(group)}</Heading>
          <p className="text-muted-foreground text-sm">
            {announcement === null
              ? m.errata_unannounced_description()
              : m.errata_published({ date: formatDay(announcement.publishedOn) })}
            {" · "}
            {m.common_cards({ count: group.total })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {announcement !== null && (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a
                  href={announcement.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={m.errata_announcement_link()}
                />
              }
            >
              {m.errata_announcement_link()}
              <ArrowUpRightIcon />
            </Button>
          )}
          <ExpandToggle
            expanded={open}
            chevronPosition="end"
            aria-controls={listId}
            onClick={onToggle}
            className="hover:bg-muted h-7 rounded-md px-2.5 text-sm font-medium"
          >
            {open ? m.errata_hide() : `${m.errata_show()} (${group.entries.length})`}
          </ExpandToggle>
        </div>
      </div>
      <div id={listId} hidden={!open}>
        {group.entries.map((entry) => (
          <ErrataEntry key={entry.card.slug} entry={entry} view={view} />
        ))}
      </div>
    </section>
  );
}

export function ErrataPage() {
  const { data } = useSuspenseQuery(errataListQueryOptions);
  const [query, setQuery] = useState("");
  const [setSlug, setSetSlug] = useState(ALL_SETS);
  const [view, setView] = useState<ErrataView>("side");
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());

  const filtering = query.trim() !== "" || setSlug !== ALL_SETS;
  const groups = groupErrata(data, { query, setSlug: setSlug === ALL_SETS ? null : setSlug });
  const visibleGroups = groups.filter((group) => group.entries.length > 0);
  const firstGroupId = groups.at(0)?.id;
  const isOpen = (group: ErrataGroup) =>
    filtering || (group.id === firstGroupId) !== toggled.has(group.id);
  const toggle = (id: string) =>
    setToggled((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  useEffect(() => {
    const openLinkedCard = () => {
      const slug = decodeURIComponent(globalThis.location.hash.slice(1));
      const groupId = errataGroupIdForCard(data, slug);
      if (groupId === null) {
        return;
      }
      setToggled((current) => {
        const next = new Set(current);
        if (groupId === firstGroupId) {
          next.delete(groupId);
        } else {
          next.add(groupId);
        }
        return next;
      });
      requestAnimationFrame(() => document.querySelector(`#${CSS.escape(slug)}`)?.scrollIntoView());
    };
    openLinkedCard();
    globalThis.addEventListener("hashchange", openLinkedCard);
    return () => globalThis.removeEventListener("hashchange", openLinkedCard);
  }, [data, firstGroupId]);

  const setCounts = countErrataBySet(data.entries);
  const setItems: Record<string, string> = {
    [ALL_SETS]: `${m.errata_set_all()} (${data.entries.length})`,
    ...Object.fromEntries(
      data.sets.map((set) => [set.slug, `${set.name} (${setCounts.get(set.slug) ?? 0})`]),
    ),
  };
  const latest = latestErrataUpdate(data.announcements);
  const stats = [
    { key: "cards", value: data.entries.length, label: m.errata_stat_cards() },
    { key: "updates", value: data.announcements.length, label: m.errata_stat_updates() },
    ...(latest === null
      ? []
      : [
          {
            key: "latest",
            value: <time dateTime={latest}>{formatDay(latest)}</time>,
            label: m.errata_stat_last_updated(),
          },
        ]),
  ];
  const newestGroup = groupErrata(data, { query: "", setSlug: null }).at(0);
  const fanUrls = (newestGroup?.entries ?? []).flatMap((entry) =>
    entry.printing?.imageId ? [imageUrl(entry.printing.imageId, "400w")] : [],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHero
        eyebrow={m.errata_hero_eyebrow()}
        title={m.errata_title()}
        lead={m.errata_description()}
        aside={<PageHeroCardFan urls={fanUrls.slice(0, 3)} />}
      >
        <dl className="mt-3 flex flex-wrap gap-x-9 gap-y-3">
          {stats.map((stat) => (
            <div key={stat.key} className="flex flex-col-reverse gap-0.5">
              <dt className="text-muted-foreground text-sm">{stat.label}</dt>
              <dd className="font-heading text-3xl leading-none font-bold tabular-nums">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </PageHero>

      <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-4 pt-6 pb-10")}>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder={m.errata_search_placeholder()}
            ariaLabel={m.errata_search_label()}
            className="w-full sm:w-72"
          />
          <Select
            value={setSlug}
            onValueChange={(next) => setSetSlug(next ?? ALL_SETS)}
            items={setItems}
          >
            <SelectTrigger
              aria-label={m.errata_set_label()}
              className="min-w-0 flex-1 sm:flex-none"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(setItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ToggleGroup
            variant="outline"
            spacing={0}
            aria-label={m.errata_view_label()}
            value={[view]}
            onValueChange={([next]) => {
              if (isErrataView(next)) {
                setView(next);
              }
            }}
            className="sm:ml-auto"
          >
            <ToggleGroupItem value="side">{m.errata_view_side()}</ToggleGroupItem>
            <ToggleGroupItem value="inline">{m.errata_view_inline()}</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
          <GroupNav groups={groups} />
          <div className="flex min-w-0 flex-col gap-10">
            {visibleGroups.length === 0 ? (
              <EmptyState
                className="py-12"
                icon={SearchXIcon}
                title={m.errata_empty_title()}
                description={m.errata_empty_description()}
              />
            ) : (
              visibleGroups.map((group) => (
                <GroupSection
                  key={group.id}
                  group={group}
                  open={isOpen(group)}
                  onToggle={() => toggle(group.id)}
                  view={view}
                />
              ))
            )}
          </div>
        </div>

        <section aria-labelledby="errata-faq" className="mt-8 flex flex-col gap-5 border-t pt-8">
          <Heading id="errata-faq">{m.errata_faq_heading()}</Heading>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <h3 className="font-semibold">{m.errata_faq_what_question()}</h3>
              <p className="text-muted-foreground">{m.errata_faq_what_answer()}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="font-semibold">{m.errata_faq_source_question()}</h3>
              <p className="text-muted-foreground">{m.errata_faq_source_answer()}</p>
            </div>
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 border-t pt-8">
          <div className="flex max-w-prose flex-col gap-1">
            <h2 className="font-semibold">{m.errata_missing_title()}</h2>
            <p className="text-muted-foreground">{m.errata_missing_body()}</p>
          </div>
          <Button nativeButton={false} render={<Link to="/contribute" />}>
            {m.errata_missing_cta()}
          </Button>
        </section>
      </div>
    </div>
  );
}

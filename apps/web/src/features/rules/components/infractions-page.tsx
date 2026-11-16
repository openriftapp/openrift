import { formatRuleNumber } from "@openrift/shared/rules";
import type { RulePenalty } from "@openrift/shared/rules-infractions";
import type { RuleLanguage, RulePageEntry } from "@openrift/shared/types/api/rules";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { Heading } from "@/components/heading";
import { PAGE_TOP_BAR_GEOMETRY } from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { ScrollToTopButton } from "@/components/ui/scroll-to-top-button";
import { TextLink } from "@/components/ui/text-link";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useRuleVersions, useRulesAtVersion } from "@/features/rules/hooks/use-rules";
import { ruleHtmlToText } from "@/features/rules/lib/rule-text";
import { rulesSettingsLabel } from "@/features/rules/lib/rule-version-label";
import type {
  InfractionBlock,
  InfractionItem,
  InfractionSection,
} from "@/features/rules/lib/rules-infractions";
import {
  buildInfractionSections,
  filterInfractionSections,
  infractionPenaltyCounts,
  nestedRuleDepth,
  ruleHeadlineName,
  splitRuleHeadline,
  withLinksTo,
  withoutPenaltyBadges,
} from "@/features/rules/lib/rules-infractions";
import { PENALTY_SLUGS, penaltySlug } from "@/features/rules/lib/rules-search-schema";
import { useInfractionsOpenStore } from "@/features/rules/stores/infractions-open-store";
import { useRulesSearchStore } from "@/features/rules/stores/rules-search-store";
import { useIsStuck } from "@/hooks/use-is-stuck";
import { useMeasuredHeight } from "@/hooks/use-measured-height";
import { useScopeEffect } from "@/hooks/use-scope-effect";
import { STICKY_SURFACE } from "@/lib/sticky-surface";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { useRuleCardPreview } from "./rule-card-preview";
import { handleRuleHtmlClick, PenaltyBadge } from "./rule-content";
import { GUIDE_DEPTH_CLASS } from "./rule-row";
import { RulesVersionHero } from "./rules-page";
import {
  RulesDocumentSelects,
  RulesSearchBar,
  RulesSettingsSheet,
  RulesViewToggle,
} from "./rules-toolbar";

const PENALTY_LABELS: Record<RulePenalty, () => string> = {
  "No Penalty": m.rules_penalty_no_penalty,
  Warning: m.rules_penalty_warning,
  "Game Loss": m.rules_penalty_game_loss,
  "Match Loss": m.rules_penalty_match_loss,
  Disqualification: m.rules_penalty_disqualification,
};

const KIND = "tournament";

const routeApi = getRouteApi("/_app/rules_/$kind_/$version_/infractions");

interface LinkTargets {
  onPage: ReadonlySet<string>;
  fullRules: string;
}

export function InfractionsPage({
  language,
  version,
}: {
  language: RuleLanguage;
  version: string;
}) {
  const navigate = useNavigate();
  const [toolbarEl, setToolbarEl] = useState<HTMLDivElement | null>(null);
  const isToolbarStuck = useIsStuck(toolbarEl);
  const toolbarHeight = useMeasuredHeight(toolbarEl);
  const { data: rulesData } = useRulesAtVersion(KIND, language, version);
  const { data: versionsData } = useRuleVersions(KIND, language);
  const { data: englishVersionsData } = useRuleVersions(KIND, "en");
  const query = useRulesSearchStore((state) => state.query);
  const penaltyParam = routeApi.useSearch({ select: (search) => search.penalty });
  const cardPreview = useRuleCardPreview();
  const openAll = useInfractionsOpenStore((state) => state.openAll);
  const closeAll = useInfractionsOpenStore((state) => state.closeAll);
  useScopeEffect(`${language} ${version}`, () => {
    closeAll();
  });

  const sections = buildInfractionSections(rulesData.rules);
  const penaltyCounts = infractionPenaltyCounts(sections);
  const requested = penaltyParam === undefined ? null : PENALTY_SLUGS[penaltyParam];
  const penalty = penaltyCounts.some((entry) => entry.penalty === requested) ? requested : null;
  const shown = filterInfractionSections(sections, penalty, query);
  const total = sections.reduce((sum, section) => sum + section.infractions.length, 0);
  const matched = shown.reduce((sum, section) => sum + section.infractions.length, 0);
  const shownNumbers = shown.flatMap((section) => [
    ...section.overviews.map((overview) => overview.entry.ruleNumber),
    ...section.infractions.map((item) => item.entry.ruleNumber),
  ]);
  const allOpen = useInfractionsOpenStore(
    (state) =>
      shownNumbers.length > 0 &&
      shownNumbers.every((ruleNumber) => state.openRules.has(ruleNumber)),
  );
  const currentVersion = versionsData.versions.find((entry) => entry.version === version);
  const links: LinkTargets = {
    onPage: new Set(shownNumbers.map((ruleNumber) => `rule-${ruleNumber}`)),
    fullRules: `/rules/${KIND}/${version}?lang=${language}`,
  };

  const setPenalty = (next: RulePenalty | null) => {
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, penalty: next === null ? undefined : penaltySlug(next) }),
      replace: true,
      resetScroll: false,
    });
  };

  const renderSettings = (triggerClassName?: string) => (
    <RulesDocumentSelects
      kind={KIND}
      language={language}
      version={version}
      view="infractions"
      versions={versionsData}
      englishVersions={englishVersionsData}
      className={triggerClassName}
    />
  );

  return (
    <>
      <RulesVersionHero
        kind={KIND}
        language={language}
        version={version}
        currentVersion={currentVersion}
        title={m.rules_infractions_title()}
        lead={m.rules_infractions_lead()}
      />
      <div className={cn(PAGE_WIDTH.capped, "pt-3", PAGE_PADDING_NO_TOP)}>
        <div className="mb-2">
          <RulesViewToggle view="infractions" version={version} language={language} />
        </div>
        <div
          ref={setToolbarEl}
          className={cn(
            PAGE_TOP_BAR_GEOMETRY,
            isToolbarStuck && STICKY_SURFACE,
            "px-safe mx-safe-neg z-20 mb-3 flex items-center gap-2 md:flex-wrap",
          )}
        >
          <RulesSearchBar
            placeholder={m.rules_infractions_search_placeholder({ count: total })}
            trailing={
              query.trim() === "" && penalty === null
                ? undefined
                : m.rules_infractions_count_filtered({ matched, count: total })
            }
          />
          <div className="hidden md:contents">{renderSettings()}</div>
          <RulesSettingsSheet
            label={rulesSettingsLabel(
              currentVersion ?? { version, documentVersion: null },
              language,
              versionsData.languages.length > 1,
            )}
          >
            {renderSettings("w-full")}
          </RulesSettingsSheet>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={1}
            aria-label={m.rules_infractions_filter_label()}
            value={[penalty ?? "all"]}
            onValueChange={([next]) => {
              setPenalty(next === undefined || next === "all" ? null : (next as RulePenalty));
            }}
            className="flex-wrap"
          >
            <ToggleGroupItem value="all">
              {m.rules_infractions_filter_all()}{" "}
              <span className="text-muted-foreground">{total}</span>
            </ToggleGroupItem>
            {penaltyCounts.map((entry) => (
              <ToggleGroupItem key={entry.penalty} value={entry.penalty}>
                {PENALTY_LABELS[entry.penalty]()}{" "}
                <span className="text-muted-foreground">{entry.count}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button
            variant="outline"
            size="sm"
            disabled={shownNumbers.length === 0}
            onClick={() => (allOpen ? closeAll() : openAll(shownNumbers))}
          >
            {allOpen ? m.rules_infractions_collapse_all() : m.rules_infractions_expand_all()}
          </Button>
        </div>
        {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- delegated link handling */}
        <div
          onClick={(event) => handleRuleHtmlClick(event, (href) => void navigate({ href }))}
          onPointerOver={cardPreview.handlePointerOver}
          onPointerOut={cardPreview.handlePointerOut}
          className="flex flex-col gap-8"
          style={
            toolbarHeight > 0
              ? ({ "--rules-anchor-offset": `${toolbarHeight}px` } as CSSProperties)
              : undefined
          }
        >
          {cardPreview.preview}
          {shown.length === 0 ? (
            <Empty>
              <EmptyDescription>{m.rules_infractions_no_matches()}</EmptyDescription>
            </Empty>
          ) : (
            shown.map((section) => (
              <InfractionSectionList
                key={section.entry.id}
                section={section}
                language={language}
                version={version}
                links={links}
              />
            ))
          )}
        </div>
      </div>
      <ScrollToTopButton />
    </>
  );
}

function InfractionSectionList({
  section,
  language,
  version,
  links,
}: {
  section: InfractionSection;
  language: RuleLanguage;
  version: string;
  links: LinkTargets;
}) {
  return (
    <section aria-labelledby={`infractions-${section.entry.ruleNumber}`}>
      <Heading
        level={2}
        id={`infractions-${section.entry.ruleNumber}`}
        className="border-border flex items-baseline gap-3 border-b pb-2"
      >
        <span className="text-muted-foreground font-mono text-xs font-normal">
          {formatRuleNumber(section.entry.ruleNumber)}
        </span>
        <span lang={language}>{ruleHtmlToText(section.entry.contentHtml)}</span>
      </Heading>
      {section.overviews.map((overview) => (
        <DisclosureRow
          key={overview.entry.id}
          entry={overview.entry}
          headlineHtml={overview.entry.contentHtml}
          language={language}
          links={links}
        >
          <div className="flex flex-col gap-2">
            {overview.entries.map((entry) => (
              <RuleLine
                key={entry.id}
                entry={entry}
                ancestor={overview.entry.ruleNumber}
                language={language}
                links={links}
              />
            ))}
          </div>
        </DisclosureRow>
      ))}
      {section.infractions.map((item) => (
        <DisclosureRow
          key={item.entry.id}
          entry={item.entry}
          headlineHtml={
            item.stated ? withoutPenaltyBadges(item.entry.contentHtml) : item.entry.contentHtml
          }
          aside={<InfractionPenalties item={item} />}
          language={language}
          links={links}
        >
          <InfractionDetails item={item} language={language} version={version} links={links} />
        </DisclosureRow>
      ))}
    </section>
  );
}

function DisclosureRow({
  entry,
  headlineHtml,
  aside,
  language,
  links,
  children,
}: {
  entry: RulePageEntry;
  headlineHtml: string;
  aside?: ReactNode;
  language: RuleLanguage;
  links: LinkTargets;
  children: ReactNode;
}) {
  const isOpen = useInfractionsOpenStore((state) => state.openRules.has(entry.ruleNumber));
  const toggle = useInfractionsOpenStore((state) => state.toggle);
  const rule = formatRuleNumber(entry.ruleNumber);
  const name = ruleHeadlineName(headlineHtml);
  const headline = splitRuleHeadline(headlineHtml);
  return (
    <div
      id={`rule-${entry.ruleNumber}`}
      className="border-border/60 scroll-mt-(--rules-anchor-offset) border-b"
    >
      <div className="relative flex items-start gap-3 py-3">
        <span className="text-muted-foreground w-12 shrink-0 pt-0.5 font-mono text-xs">{rule}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
          <div lang={language} className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div
              className="rule-html font-semibold [&_a]:relative [&_a]:z-10"
              dangerouslySetInnerHTML={{
                __html: withLinksTo(headline.titleHtml, links.onPage, links.fullRules),
              }}
            />
            {headline.bodyHtml !== "" && (
              <div
                className="rule-html text-muted-foreground [&_a]:relative [&_a]:z-10"
                dangerouslySetInnerHTML={{
                  __html: withLinksTo(headline.bodyHtml, links.onPage, links.fullRules),
                }}
              />
            )}
          </div>
          {aside}
        </div>
        <ExpandToggle
          expanded={isOpen}
          onClick={() => toggle(entry.ruleNumber)}
          aria-label={
            isOpen
              ? m.rules_infractions_collapse({ rule, name })
              : m.rules_infractions_expand({ rule, name })
          }
          className="rounded-md pt-0.5 after:absolute after:inset-0"
        />
      </div>
      {isOpen && <div className="pb-4 sm:pl-15">{children}</div>}
    </div>
  );
}

function InfractionPenalties({ item }: { item: InfractionItem }) {
  const first = item.penalties.at(0);
  const last = item.penalties.at(-1);
  if (first === undefined || last === undefined) {
    return null;
  }
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
      <PenaltyBadge penalty={first}>{PENALTY_LABELS[first]()}</PenaltyBadge>
      {last !== first && (
        <>
          <span className="text-muted-foreground text-sm">{m.rules_penalty_range_separator()}</span>
          <PenaltyBadge penalty={last}>{PENALTY_LABELS[last]()}</PenaltyBadge>
        </>
      )}
    </div>
  );
}

function InfractionDetails({
  item,
  language,
  version,
  links,
}: {
  item: InfractionItem;
  language: RuleLanguage;
  version: string;
  links: LinkTargets;
}) {
  return (
    <div className="flex flex-col gap-2">
      {item.blocks.map((block) => (
        <InfractionBlockView
          key={blockKey(block)}
          block={block}
          ancestor={item.entry.ruleNumber}
          language={language}
          links={links}
        />
      ))}
      <TextLink
        className="self-start text-sm"
        render={
          <Link
            to="/rules/$kind/$version"
            params={{ kind: KIND, version }}
            search={{ lang: language }}
            hash={`rule-${item.entry.ruleNumber}`}
          />
        }
      >
        {m.rules_infractions_show_in_rules({ rule: formatRuleNumber(item.entry.ruleNumber) })}
      </TextLink>
    </div>
  );
}

function blockKey(block: InfractionBlock): string {
  return block.kind === "line" ? block.entry.id : block.heading.id;
}

function InfractionBlockView({
  block,
  ancestor,
  language,
  links,
}: {
  block: InfractionBlock;
  ancestor: string;
  language: RuleLanguage;
  links: LinkTargets;
}) {
  if (block.kind === "line") {
    return <RuleLine entry={block.entry} ancestor={ancestor} language={language} links={links} />;
  }
  return (
    <div
      className={cn(
        "my-1 flex flex-col gap-2 rounded-lg p-3",
        block.block === "remedies"
          ? "bg-card ring-border ring-1"
          : "border-border border border-dashed",
      )}
    >
      <div className="flex items-baseline gap-3">
        <div
          lang={language}
          className={cn(
            "rule-html min-w-0 font-semibold [&_.rule-example]:m-0! [&_.rule-example]:bg-transparent! [&_.rule-example]:p-0!",
            block.block === "remedies" ? "text-primary" : "text-muted-foreground",
          )}
          dangerouslySetInnerHTML={{ __html: block.heading.contentHtml }}
        />
        <span className="text-muted-foreground font-mono text-xs">
          {formatRuleNumber(block.heading.ruleNumber)}
        </span>
      </div>
      {block.entries.map((entry) => (
        <RuleLine
          key={entry.id}
          entry={entry}
          ancestor={block.heading.ruleNumber}
          language={language}
          links={links}
        />
      ))}
    </div>
  );
}

function RuleLine({
  entry,
  ancestor,
  language,
  links,
}: {
  entry: RulePageEntry;
  ancestor: string;
  language: RuleLanguage;
  links: LinkTargets;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline gap-3",
        GUIDE_DEPTH_CLASS[nestedRuleDepth(entry.ruleNumber, ancestor)],
      )}
    >
      <span className="text-muted-foreground min-w-14 shrink-0 font-mono text-xs sm:min-w-18">
        {formatRuleNumber(entry.ruleNumber)}
      </span>
      <div
        lang={language}
        className="rule-html min-w-0 flex-1"
        dangerouslySetInnerHTML={{
          __html: withLinksTo(entry.contentHtml, links.onPage, links.fullRules),
        }}
      />
    </div>
  );
}

import { formatDay } from "@openrift/shared/format-date";
import { formatRuleNumber } from "@openrift/shared/rules";
import type { RuleKind, RuleLanguage } from "@openrift/shared/types/api/rules";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { BookOpenIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { PAGE_HERO_EYEBROW_CLASS, PageHero, PageHeroStats } from "@/components/layout/page-hero";
import { PageToc, PageTocMobileTrigger } from "@/components/layout/page-toc";
import type { PageTocItem } from "@/components/layout/page-toc";
import { PAGE_TOP_BAR_GEOMETRY } from "@/components/layout/page-top-bar";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { featuredBoardStatesQueryOptions } from "@/features/board-states/lib/board-states-queries";
import { useRuleVersions, useRulesAtVersion } from "@/features/rules/hooks/use-rules";
import { buildRuleExamplesMap } from "@/features/rules/lib/rule-examples";
import { ruleHtmlToText } from "@/features/rules/lib/rule-text";
import { ruleVersionLabels } from "@/features/rules/lib/rule-version-label";
import {
  buildChangeKindMap,
  computeAncestorsByRule,
  computeFoldGroups,
  computeSearchResult,
  detectMoves,
  detectSilentChanges,
  EMPTY_ANCESTORS,
  EMPTY_STRING_MAP,
  EMPTY_STRING_SET,
  mergeTombstones,
  parseSearchTerms,
  withSourceContent,
} from "@/features/rules/lib/rules-changes";
import type { RuleEntry } from "@/features/rules/lib/rules-changes";
import { ruleKindDescription, ruleKindTitle } from "@/features/rules/lib/rules-kinds";
import { rulesSourceQueryOptions } from "@/features/rules/lib/rules-queries";
import { useRuleExamplesStore } from "@/features/rules/stores/rule-examples-store";
import { useRulesChangesViewStore } from "@/features/rules/stores/rules-changes-view-store";
import { useRulesFoldStore } from "@/features/rules/stores/rules-fold-store";
import { useRulesSearchStore } from "@/features/rules/stores/rules-search-store";
import { useFeatureEnabled } from "@/hooks/use-feature-flags";
import { useHydrated } from "@/hooks/use-hydrated";
import { useIsStuck } from "@/hooks/use-is-stuck";
import { useMeasuredHeight } from "@/hooks/use-measured-height";
import { useScopeEffect } from "@/hooks/use-scope-effect";
import { STICKY_SURFACE } from "@/lib/sticky-surface";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { useRuleCardPreview } from "./rule-card-preview";
import { handleRuleHtmlClick, VersionComments } from "./rule-content";
import { RuleRow } from "./rule-row";
import { ChangesSummary } from "./rules-changes-summary";
import { ChangesViewToggle, KindTabs, RulesLanguageSelect, RulesSearchBar } from "./rules-toolbar";

function buildRulesTocItems(rules: RuleEntry[]): PageTocItem[] {
  return rules
    .filter((rule) => rule.ruleType === "title" || rule.ruleType === "subtitle")
    .map((rule) => ({
      id: `rule-${rule.ruleNumber}`,
      label: `${formatRuleNumber(rule.ruleNumber)} ${ruleHtmlToText(rule.contentHtml)}`,
      level: rule.ruleType === "subtitle" ? 1 : 0,
    }));
}

/**
 * Returns the version immediately before `current` in the chronologically
 * ascending `versions` list, or null if there is no earlier version.
 */
function getPreviousVersion(
  versions: readonly { version: string }[],
  current: string,
): string | null {
  const index = versions.findIndex((entry) => entry.version === current);
  if (index <= 0) {
    return null;
  }
  return versions[index - 1]?.version ?? null;
}

export function RulesPage({
  kind,
  language = "en",
  version,
}: {
  kind: RuleKind;
  language?: RuleLanguage;
  version: string | null;
}) {
  if (version === null) {
    return <RulesEmpty kind={kind} />;
  }
  return <RulesContent kind={kind} language={language} version={version} />;
}

function NoRulesYet() {
  return (
    <EmptyState
      icon={BookOpenIcon}
      title={m.rules_empty_title()}
      description={m.rules_empty_description()}
    />
  );
}

function RulesHero({ kind, children }: { kind: RuleKind; children?: ReactNode }) {
  return (
    <PageHero
      eyebrow={
        <>
          <div className="mb-2">
            <KindTabs kind={kind} />
          </div>
          <span className={PAGE_HERO_EYEBROW_CLASS}>{m.rules_hero_eyebrow()}</span>
        </>
      }
      title={ruleKindTitle(kind)}
      lead={ruleKindDescription(kind)}
    >
      {children}
    </PageHero>
  );
}

function RulesEmpty({ kind }: { kind: RuleKind }) {
  return (
    <>
      <RulesHero kind={kind} />
      <div className={cn(PAGE_WIDTH.capped, "pt-3", PAGE_PADDING_NO_TOP)}>
        <NoRulesYet />
      </div>
    </>
  );
}

function RulesContent({
  kind,
  language,
  version,
}: {
  kind: RuleKind;
  language: RuleLanguage;
  version: string;
}) {
  const navigate = useNavigate();
  const [toolbarEl, setToolbarEl] = useState<HTMLDivElement | null>(null);
  const isToolbarStuck = useIsStuck(toolbarEl);
  const toolbarHeight = useMeasuredHeight(toolbarEl);
  // html's scroll-padding already clears the header; anchor jumps also clear the sticky toolbar.
  const anchorOffset = toolbarHeight > 0 ? `${toolbarHeight}px` : undefined;
  const { data: rulesData } = useRulesAtVersion(kind, language, version);
  const { data: versionsData } = useRuleVersions(kind, language);
  const { data: englishVersionsData } = useRuleVersions(kind, "en");
  const debouncedSearchQuery = useRulesSearchStore((state) => state.query);

  // Reset fold state when navigating between rules documents — the store is
  // global, so without this it would leak across pages.
  const expandAll = useRulesFoldStore((state) => state.expandAll);
  const resetSearch = useRulesSearchStore((state) => state.reset);
  const searchScope = useRef<string | null>(null);
  useScopeEffect(`${kind} ${language} ${version}`, (scope) => {
    expandAll();
    // The first scope keeps a deep-linked `?q=`; the search bar seeds the store from the URL.
    if (searchScope.current !== null && searchScope.current !== scope) {
      resetSearch();
    }
    searchScope.current = scope;
  });

  const isHydrated = useHydrated();
  const cardPreview = useRuleCardPreview();
  const boardStatesEnabled = useFeatureEnabled("board-states");
  const { data: featuredBoardStates } = useQuery({
    ...featuredBoardStatesQueryOptions(),
    enabled: isHydrated && boardStatesEnabled,
  });
  const setExamplesByRule = useRuleExamplesStore((state) => state.setExamplesByRule);
  useEffect(() => {
    setExamplesByRule(buildRuleExamplesMap(featuredBoardStates ?? [], kind, version));
  }, [featuredBoardStates, kind, version, setExamplesByRule]);

  const versions = versionsData.versions;
  const currentVersion = versions.find((v) => v.version === version);
  const commentsHtml = currentVersion?.commentsHtml ?? null;
  const previousVersion =
    getPreviousVersion(versions, version) ??
    (language === "en" ? null : getPreviousVersion(englishVersionsData.versions, version));
  const versionLabels = ruleVersionLabels([...englishVersionsData.versions, ...versions]);
  const versionItems = versions
    .toReversed()
    .map((entry) => ({ value: entry.version, label: versionLabels.get(entry.version) }));

  const searchTerms = parseSearchTerms(debouncedSearchQuery);
  const isSearching = searchTerms.length > 0 && debouncedSearchQuery.trim().length >= 2;
  const isEmpty = rulesData.rules.length === 0;

  const changesView = useRulesChangesViewStore((state) => state.byKind[kind]);
  const wantsChanges = changesView !== "off" && previousVersion !== null && !isSearching;
  const { data: changes } = useQuery({
    ...rulesSourceQueryOptions(kind, language, version),
    enabled: isHydrated && wantsChanges,
  });
  const showChanges = wantsChanges && changes !== undefined;
  const baseRules: RuleEntry[] =
    showChanges && changes ? withSourceContent(rulesData.rules, changes.current) : rulesData.rules;

  const moves = showChanges && changes ? detectMoves(baseRules, changes, version) : null;
  const movedTombstones = moves?.fromRemovedSet ?? EMPTY_STRING_SET;
  const rules =
    showChanges && changes
      ? mergeTombstones(baseRules, changes.removed, movedTombstones)
      : baseRules;
  const silentChanges =
    showChanges && changes
      ? detectSilentChanges(
          rules,
          changes,
          version,
          moves?.newToOld ?? EMPTY_STRING_MAP,
          moves?.displacedSet ?? EMPTY_STRING_SET,
        )
      : EMPTY_STRING_SET;
  const changeKindByRule =
    showChanges && changes
      ? buildChangeKindMap(
          rules,
          changes,
          version,
          moves?.newToOld ?? EMPTY_STRING_MAP,
          moves?.displacedSet ?? EMPTY_STRING_SET,
          movedTombstones,
          silentChanges,
        )
      : null;

  const foldGroups = computeFoldGroups(rules);
  const ancestorsByRule = computeAncestorsByRule(rules, foldGroups);
  const searchResult = isSearching ? computeSearchResult(rules, searchTerms) : null;
  const noSearchResults =
    isSearching && searchResult !== null && searchResult.visibleIndices.length === 0;
  const tocItems = buildRulesTocItems(rules);
  const ruleCountLabel =
    searchResult === null
      ? m.rules_count({ count: rules.length })
      : m.rules_count_filtered({ matched: searchResult.matchSet.size, count: rules.length });

  const stats = [
    ...(currentVersion?.documentVersion
      ? [{ key: "version", value: currentVersion.documentVersion, label: m.rules_stat_version() }]
      : []),
    {
      key: "languages",
      value: (currentVersion?.languages ?? [language]).length,
      label: m.rules_stat_languages(),
    },
    {
      key: "published",
      value: <time dateTime={version}>{formatDay(version)}</time>,
      label: m.rules_stat_published(),
    },
  ];

  return (
    <>
      <RulesHero kind={kind}>
        <PageHeroStats stats={stats} />
      </RulesHero>
      <div className={cn(PAGE_WIDTH.capped, "pt-3", PAGE_PADDING_NO_TOP)}>
        <div
          ref={setToolbarEl}
          className={cn(
            PAGE_TOP_BAR_GEOMETRY,
            isToolbarStuck && STICKY_SURFACE,
            "px-safe mx-safe-neg z-20 mb-4 flex flex-wrap items-center gap-2",
          )}
        >
          <PageTocMobileTrigger
            items={tocItems}
            className="sm:w-auto sm:gap-1.5 sm:px-2.5"
            labelClassName="hidden sm:inline"
          />
          <RulesSearchBar trailing={ruleCountLabel} />
          <RulesLanguageSelect
            kind={kind}
            language={language}
            languages={versionsData.languages}
            versionLanguages={currentVersion?.languages ?? [language]}
          />
          {versions.length > 1 ? (
            <Select
              items={versionItems}
              value={version}
              onValueChange={(nextVersion) => {
                if (typeof nextVersion !== "string" || nextVersion === version) {
                  return;
                }
                void navigate({
                  to: "/rules/$kind/$version",
                  params: { kind, version: nextVersion },
                  search: { lang: language },
                });
              }}
            >
              <SelectTrigger className="text-muted-foreground" aria-label={m.rules_version_label()}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versionItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-muted-foreground text-sm">{versionLabels.get(version)}</span>
          )}
          {!isSearching && (
            <ChangesViewToggle kind={kind} hasPreviousVersion={previousVersion !== null} />
          )}
        </div>

        {isEmpty ? (
          <NoRulesYet />
        ) : (
          <div
            className="flex gap-6"
            style={
              anchorOffset === undefined
                ? undefined
                : ({
                    "--rules-anchor-offset": anchorOffset,
                    "--sticky-top": `calc(var(--header-height) + ${anchorOffset} + 1rem)`,
                  } as CSSProperties)
            }
          >
            <PageToc items={tocItems} />
            {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- delegated link handling */}
            <div
              className="min-w-0 flex-1"
              lang={language}
              onClick={(event) => handleRuleHtmlClick(event, (href) => void navigate({ href }))}
              onPointerOver={cardPreview.handlePointerOver}
              onPointerOut={cardPreview.handlePointerOut}
            >
              {cardPreview.preview}
              {commentsHtml && !isSearching && <VersionComments html={commentsHtml} />}
              {showChanges && previousVersion && changes && moves && (
                <ChangesSummary
                  previousVersionLabel={versionLabels.get(previousVersion) ?? previousVersion}
                  changes={changes}
                  moves={moves}
                  silentChanges={silentChanges}
                />
              )}
              {noSearchResults ? (
                <Empty>
                  <EmptyDescription>{m.rules_search_no_matches()}</EmptyDescription>
                </Empty>
              ) : searchResult === null ? (
                rules.map((rule) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    ancestors={ancestorsByRule.get(rule.ruleNumber) ?? EMPTY_ANCESTORS}
                    hasChildren={foldGroups.has(rule.ruleNumber)}
                    changeKind={changeKindByRule?.get(rule.ruleNumber)}
                    previousContent={
                      showChanges && changes && !moves?.displacedSet.has(rule.ruleNumber)
                        ? changes.modifiedPrev[rule.ruleNumber]
                        : undefined
                    }
                    relatedRuleNumber={
                      moves?.newToOld.get(rule.ruleNumber) ?? moves?.oldToNew.get(rule.ruleNumber)
                    }
                    changesView={changesView === "off" || !showChanges ? undefined : changesView}
                    previousVersionLabel={
                      previousVersion === null ? undefined : versionLabels.get(previousVersion)
                    }
                    versionLabel={versionLabels.get(version)}
                  />
                ))
              ) : (
                searchResult.visibleIndices.map((index) => {
                  const rule = rules[index];
                  if (!rule) {
                    return null;
                  }
                  const isContext =
                    searchResult.ancestorSet.has(index) && !searchResult.matchSet.has(index);
                  return (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      ancestors={EMPTY_ANCESTORS}
                      hasChildren={false}
                      isContext={isContext}
                    />
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

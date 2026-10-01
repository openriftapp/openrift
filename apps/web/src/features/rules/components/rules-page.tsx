import type { RuleKind } from "@openrift/shared/types/api/rules";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { BookOpenIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { PageToc, PageTocMobileTrigger } from "@/components/layout/page-toc";
import type { PageTocItem } from "@/components/layout/page-toc";
import {
  PAGE_TOP_BAR_GEOMETRY,
  PageTopBar,
  PageTopBarActions,
  PageTopBarSticky,
  PageTopBarTitle,
  useMeasuredHeight,
} from "@/components/layout/page-top-bar";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRuleVersions, useRulesAtVersion } from "@/features/rules/hooks/use-rules";
import { featuredBoardStatesQueryOptions } from "@/features/rules/lib/board-states-queries";
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
import { ruleKindTitle } from "@/features/rules/lib/rules-kinds";
import { rulesSourceQueryOptions } from "@/features/rules/lib/rules-queries";
import { useRuleExamplesStore } from "@/features/rules/stores/rule-examples-store";
import { useRulesDiffExpandStore } from "@/features/rules/stores/rules-diff-expand-store";
import { useRulesFoldStore } from "@/features/rules/stores/rules-fold-store";
import { useRulesSearchStore } from "@/features/rules/stores/rules-search-store";
import { useRulesShowChangesStore } from "@/features/rules/stores/rules-show-changes-store";
import { useFeatureEnabled } from "@/hooks/use-feature-flags";
import { useHydrated } from "@/hooks/use-hydrated";
import { useIsStuck } from "@/hooks/use-is-stuck";
import { useScopeEffect } from "@/hooks/use-scope-effect";
import { STICKY_SURFACE } from "@/lib/sticky-surface";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { formatRuleNumber, handleRuleHtmlClick, VersionComments } from "./rule-content";
import { RuleRow } from "./rule-row";
import { ChangesSummary } from "./rules-changes-summary";
import {
  ExpandCollapseAllButton,
  KindTabs,
  RulesSearchBar,
  ShowChangesToggle,
} from "./rules-toolbar";

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

export function RulesPage({ kind, version }: { kind: RuleKind; version: string | null }) {
  if (version === null) {
    return <RulesEmpty kind={kind} />;
  }
  return <RulesContent kind={kind} version={version} />;
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

function RulesEmpty({ kind }: { kind: RuleKind }) {
  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{ruleKindTitle(kind)}</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, "pt-3", PAGE_PADDING_NO_TOP)}>
        <div className="mb-4">
          <KindTabs kind={kind} />
        </div>
        <NoRulesYet />
      </div>
    </>
  );
}

function RulesContent({ kind, version }: { kind: RuleKind; version: string }) {
  const navigate = useNavigate();
  // The search toolbar sticks below the title bar, so its offset must include
  // the bar's measured height on top of the global header height.
  const [topBarEl, setTopBarEl] = useState<HTMLDivElement | null>(null);
  const topBarHeight = useMeasuredHeight(topBarEl);
  const [toolbarEl, setToolbarEl] = useState<HTMLDivElement | null>(null);
  const isToolbarStuck = useIsStuck(toolbarEl);
  const { data: rulesData } = useRulesAtVersion(kind, version);
  const { data: versionsData } = useRuleVersions(kind);
  const debouncedSearchQuery = useRulesSearchStore((state) => state.query);

  // Reset fold state when navigating between rules documents — the store is
  // global, so without this it would leak across pages.
  const expandAll = useRulesFoldStore((state) => state.expandAll);
  const resetSearch = useRulesSearchStore((state) => state.reset);
  const resetDiffExpands = useRulesDiffExpandStore((state) => state.reset);
  useScopeEffect(`${kind} ${version}`, () => {
    expandAll();
    resetSearch();
    resetDiffExpands();
  });

  const isHydrated = useHydrated();
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
  const commentsHtml = versions.find((v) => v.version === version)?.commentsHtml ?? null;
  const previousVersion = getPreviousVersion(versions, version);
  const versionLabels = ruleVersionLabels(versions);
  const versionItems = versions
    .toReversed()
    .map((entry) => ({ value: entry.version, label: versionLabels.get(entry.version) }));

  const searchTerms = parseSearchTerms(debouncedSearchQuery);
  const isSearching = searchTerms.length > 0 && debouncedSearchQuery.trim().length >= 2;
  const isEmpty = rulesData.rules.length === 0;

  const showChangesPref = useRulesShowChangesStore((state) => state.byKind[kind]);
  const wantsChanges = showChangesPref && previousVersion !== null && !isSearching;
  const { data: changes } = useQuery({
    ...rulesSourceQueryOptions(kind, version),
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
  const foldGroupKeys = [...foldGroups.keys()];
  const searchResult = isSearching ? computeSearchResult(rules, searchTerms) : null;
  const noSearchResults =
    isSearching && searchResult !== null && searchResult.visibleIndices.length === 0;
  const tocItems = buildRulesTocItems(rules);
  const ruleCountLabel =
    searchResult === null
      ? m.rules_count({ count: rules.length })
      : m.rules_count_filtered({ matched: searchResult.matchSet.size, count: rules.length });

  return (
    <>
      <PageTopBarSticky width="capped" ref={setTopBarEl}>
        <PageTopBar>
          <PageTopBarTitle>{ruleKindTitle(kind)}</PageTopBarTitle>
          <PageTopBarActions>
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
                  });
                }}
              >
                <SelectTrigger className="text-muted-foreground">
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
          </PageTopBarActions>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, "pt-3", PAGE_PADDING_NO_TOP)}>
        <div className="mb-4">
          <KindTabs kind={kind} />
        </div>

        {isEmpty ? (
          <NoRulesYet />
        ) : (
          <div className="flex gap-6">
            <PageToc items={tocItems} />
            {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- delegated link handling */}
            <div
              className="min-w-0 flex-1"
              onClick={(event) => handleRuleHtmlClick(event, (href) => void navigate({ href }))}
            >
              <div
                ref={setToolbarEl}
                className={cn(
                  PAGE_TOP_BAR_GEOMETRY,
                  isToolbarStuck && STICKY_SURFACE,
                  "pr-safe mr-safe-neg max-lg:px-safe max-lg:mx-safe-neg @container z-20 mb-4 flex flex-wrap items-center gap-3",
                )}
                // -1px matches PAGE_TOP_BAR_GEOMETRY's own offset, keeping this tier flush.
                style={{ top: `calc(var(--header-height) + ${topBarHeight - 1}px)` }}
              >
                <PageTocMobileTrigger
                  items={tocItems}
                  className="@2xl:w-auto @2xl:gap-1.5 @2xl:px-2.5"
                  labelClassName="hidden @2xl:inline"
                />
                <RulesSearchBar trailing={ruleCountLabel} />
                {foldGroupKeys.length > 0 && !isSearching && (
                  <ExpandCollapseAllButton foldGroupKeys={foldGroupKeys} />
                )}
                {!isSearching && (
                  <ShowChangesToggle kind={kind} hasPreviousVersion={previousVersion !== null} />
                )}
              </div>
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
                  <EmptyHeader>
                    <EmptyTitle>{m.rules_search_empty_title()}</EmptyTitle>
                    <EmptyDescription>{m.rules_search_empty_description()}</EmptyDescription>
                  </EmptyHeader>
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

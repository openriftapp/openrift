import { isRuleLanguage } from "@openrift/shared/rules";
import type { RuleKind, RuleLanguage } from "@openrift/shared/types/api/rules";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { FileClockIcon } from "lucide-react";
import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SearchInput } from "@/features/cards/components/search-input";
import {
  isRulesChangesView,
  useRulesChangesViewStore,
} from "@/features/rules/stores/rules-changes-view-store";
import { useRulesSearchStore } from "@/features/rules/stores/rules-search-store";
import { useFeatureEnabled } from "@/hooks/use-feature-flags";
import { useScopeEffect } from "@/hooks/use-scope-effect";
import { DISPLAY_LOCALE_LABELS } from "@/lib/display-locale";
import { m } from "@/paraglide/messages.js";

export function ChangesViewToggle({
  kind,
  hasPreviousVersion,
}: {
  kind: RuleKind;
  hasPreviousVersion: boolean;
}) {
  const view = useRulesChangesViewStore((state) => state.byKind[kind]);
  const setView = useRulesChangesViewStore((state) => state.setView);

  const control = (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
        <FileClockIcon className="size-4" aria-hidden="true" />
        {m.rules_show_changes_short()}
      </span>
      <ToggleGroup
        variant="outline"
        spacing={0}
        aria-label={m.rules_show_changes()}
        value={[hasPreviousVersion ? view : "off"]}
        disabled={!hasPreviousVersion}
        onValueChange={([next]) => {
          if (isRulesChangesView(next)) {
            setView(kind, next);
          }
        }}
      >
        <ToggleGroupItem value="off">{m.rules_changes_off()}</ToggleGroupItem>
        <ToggleGroupItem value="inline">{m.rules_changes_inline()}</ToggleGroupItem>
        <ToggleGroupItem value="side">{m.rules_changes_side()}</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );

  if (hasPreviousVersion) {
    return control;
  }
  return (
    <Tooltip>
      {/* A disabled control takes no pointer events: the tooltip trigger wraps it. */}
      <TooltipTrigger render={<span className="inline-flex" />}>{control}</TooltipTrigger>
      <TooltipContent>{m.rules_show_changes_unavailable()}</TooltipContent>
    </Tooltip>
  );
}

export function RulesLanguageSelect({
  kind,
  language,
  languages,
  versionLanguages,
}: {
  kind: RuleKind;
  language: RuleLanguage;
  languages: readonly RuleLanguage[];
  versionLanguages: readonly RuleLanguage[];
}) {
  const navigate = useNavigate();
  if (languages.length < 2) {
    return null;
  }
  const items = languages.map((value) => ({ value, label: DISPLAY_LOCALE_LABELS[value] }));
  return (
    <Select
      items={items}
      value={language}
      onValueChange={(next) => {
        if (!isRuleLanguage(next) || next === language) {
          return;
        }
        if (versionLanguages.includes(next)) {
          void navigate({ to: ".", search: (prev) => ({ ...prev, lang: next }) });
        } else {
          void navigate({ to: "/rules/$kind", params: { kind }, search: { lang: next } });
        }
      }}
    >
      <SelectTrigger className="text-muted-foreground" aria-label={m.rules_language_label()}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} lang={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function KindTabs({ kind }: { kind: RuleKind | "glossary" }) {
  const navigate = useNavigate();
  const glossaryEnabled = useFeatureEnabled("glossary");
  return (
    <Tabs
      value={kind}
      onValueChange={(value) => {
        if (value === kind) {
          return;
        }
        if (value === "glossary") {
          void navigate({ to: "/glossary" });
          return;
        }
        if (value !== "core" && value !== "tournament") {
          return;
        }
        void navigate({
          to: "/rules/$kind",
          params: { kind: value },
          search: kind === "glossary" ? {} : (prev) => prev,
        });
      }}
    >
      <TabsList variant="line">
        <TabsTrigger value="core">{m.rules_tab_core()}</TabsTrigger>
        <TabsTrigger value="tournament">{m.rules_tab_tournament()}</TabsTrigger>
        {glossaryEnabled && <TabsTrigger value="glossary">{m.nav_glossary()}</TabsTrigger>}
      </TabsList>
    </Tabs>
  );
}

export function RulesSearchBar({ trailing }: { trailing: string }) {
  const urlQuery = useSearch({ strict: false, select: (search) => search.q });
  const [draft, setDraft] = useState(typeof urlQuery === "string" ? urlQuery : "");
  const setQuery = useRulesSearchStore((state) => state.setQuery);
  const resetSignal = useRulesSearchStore((state) => state.resetSignal);
  const navigate = useNavigate();
  const debouncedApply = useDebouncedCallback(
    (next: string) => {
      setQuery(next);
      // Use replace, not push: avoids one history entry per keystroke.
      void navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({ ...prev, q: next === "" ? undefined : next }),
        replace: true,
      });
    },
    { wait: 150 },
  );

  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);
  if (seenUrlQuery !== urlQuery) {
    setSeenUrlQuery(urlQuery);
    if (typeof urlQuery === "string" && urlQuery !== draft) {
      setDraft(urlQuery);
    }
  }
  useScopeEffect(urlQuery, (query) => {
    if (typeof query === "string" && query !== useRulesSearchStore.getState().query) {
      setQuery(query);
    }
  });

  // Gated on resetSignal, not the query value: during normal typing the store
  // is briefly empty until the debounce fires, which would wipe the draft.
  const [handledSignal, setHandledSignal] = useState(resetSignal);
  if (handledSignal !== resetSignal) {
    setHandledSignal(resetSignal);
    if (resetSignal > 0) {
      setDraft("");
    }
  }

  return (
    <SearchInput
      value={draft}
      onValueChange={(next) => {
        setDraft(next);
        debouncedApply(next);
      }}
      onClear={() => {
        setDraft("");
        debouncedApply("");
      }}
      placeholder={m.rules_search_placeholder()}
      trailing={trailing}
      className="min-w-[200px] flex-1"
    />
  );
}

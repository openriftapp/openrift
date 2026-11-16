import type {
  RuleKind,
  RuleLanguage,
  RuleVersionsListResponse,
} from "@openrift/shared/types/api/rules";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronDownIcon, FileClockIcon, SlidersHorizontalIcon } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup } from "@/components/ui/radio-group";
import { RadioOptionRow } from "@/components/ui/radio-option-row";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ruleVersionLabels } from "@/features/rules/lib/rule-version-label";
import type { RulesView } from "@/features/rules/lib/rules-version-loader";
import {
  isRulesChangesView,
  useRulesChangesViewStore,
} from "@/features/rules/stores/rules-changes-view-store";
import { useRulesSearchStore } from "@/features/rules/stores/rules-search-store";
import { useFeatureEnabled } from "@/hooks/use-feature-flags";
import { useScopeEffect } from "@/hooks/use-scope-effect";
import { useSearchUrlSync } from "@/hooks/use-search-url-sync";
import { DISPLAY_LOCALE_LABELS } from "@/lib/display-locale";
import { cn } from "@/lib/utils";
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

export function ChangesViewOptions({
  kind,
  hasPreviousVersion,
}: {
  kind: RuleKind;
  hasPreviousVersion: boolean;
}) {
  const view = useRulesChangesViewStore((state) => state.byKind[kind]);
  const setView = useRulesChangesViewStore((state) => state.setView);
  const changed = hasPreviousVersion && view !== "off";
  const label = changed ? m.rules_view_options_changed() : m.rules_view_options();

  if (!hasPreviousVersion) {
    return (
      <Tooltip>
        {/* A disabled control takes no pointer events: the tooltip trigger wraps it. */}
        <TooltipTrigger render={<span className="inline-flex shrink-0" />}>
          <Button variant="outline" size="icon" disabled aria-label={label}>
            <SlidersHorizontalIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{m.rules_show_changes_unavailable()}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={<Button variant="outline" size="icon" />}
              className="relative shrink-0"
              aria-label={label}
            />
          }
        >
          <SlidersHorizontalIcon className="size-4" />
          {changed && (
            <span className="bg-primary ring-background absolute top-0.5 right-0.5 size-2 rounded-full ring-2" />
          )}
        </TooltipTrigger>
        <TooltipContent>{m.rules_view_options()}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-72 gap-1.5">
        <p className="text-muted-foreground px-2 pb-1 text-xs font-medium">
          {m.rules_changes_heading()}
        </p>
        <RadioGroup
          aria-label={m.rules_show_changes()}
          value={view}
          onValueChange={(next) => {
            if (isRulesChangesView(next)) {
              setView(kind, next);
            }
          }}
          className="gap-1"
        >
          <RadioOptionRow
            value="off"
            title={m.rules_changes_off()}
            description={m.rules_changes_off_hint()}
          />
          <RadioOptionRow
            value="inline"
            title={m.rules_changes_inline()}
            description={m.rules_changes_inline_hint()}
          />
          <RadioOptionRow
            value="side"
            title={m.rules_changes_side()}
            description={m.rules_changes_side_hint()}
          />
        </RadioGroup>
      </PopoverContent>
    </Popover>
  );
}

function RulesLanguageSelect({
  kind,
  language,
  languages,
  versionLanguages,
  view,
  englishVersions,
  className,
}: {
  kind: RuleKind;
  language: RuleLanguage;
  languages: readonly RuleLanguage[];
  versionLanguages: readonly RuleLanguage[];
  view: RulesView;
  englishVersions: RuleVersionsListResponse;
  className?: string;
}) {
  const navigate = useNavigate();
  if (languages.length < 2) {
    return null;
  }
  const items = languages.map((value) => ({
    value,
    label: DISPLAY_LOCALE_LABELS[value],
    lang: value,
  }));
  return (
    <SimpleSelect
      items={items}
      value={language}
      onChange={(next) => {
        if (next === language) {
          return;
        }
        if (versionLanguages.includes(next)) {
          void navigate({ to: ".", search: (prev) => ({ ...prev, lang: next }) });
          return;
        }
        const newest = englishVersions.versions.findLast((entry) => entry.languages.includes(next));
        if (view === "infractions" && newest !== undefined) {
          void navigate({
            to: "/rules/$kind/$version/infractions",
            params: { kind, version: newest.version },
            search: { lang: next },
          });
          return;
        }
        void navigate({ to: "/rules/$kind", params: { kind }, search: { lang: next } });
      }}
      label={m.rules_language_label()}
      className={cn("text-muted-foreground", className)}
    />
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

export function RulesViewToggle({
  view,
  version,
  language,
}: {
  view: RulesView;
  version: string;
  language: RuleLanguage;
}) {
  const navigate = useNavigate();
  return (
    <ToggleGroup
      variant="outline"
      spacing={0}
      aria-label={m.rules_view_label()}
      value={[view]}
      onValueChange={([next]) => {
        if (next === view || (next !== "document" && next !== "infractions")) {
          return;
        }
        void navigate({
          to:
            next === "infractions" ? "/rules/$kind/$version/infractions" : "/rules/$kind/$version",
          params: { kind: "tournament", version },
          search: { lang: language },
        });
      }}
      className="shrink-0"
    >
      <ToggleGroupItem value="document">{m.rules_view_document()}</ToggleGroupItem>
      <ToggleGroupItem value="infractions">{m.rules_view_infractions()}</ToggleGroupItem>
    </ToggleGroup>
  );
}

function RulesVersionSelect({
  kind,
  language,
  version,
  items,
  fallbackLabel,
  view,
  className,
}: {
  kind: RuleKind;
  language: RuleLanguage;
  version: string;
  items: readonly { value: string; label: string | undefined }[];
  fallbackLabel: string | undefined;
  view: RulesView;
  className?: string;
}) {
  const navigate = useNavigate();
  if (items.length < 2) {
    return <span className="text-muted-foreground text-sm">{fallbackLabel}</span>;
  }
  return (
    <SimpleSelect
      items={items.map((item) => ({ value: item.value, label: item.label ?? item.value }))}
      value={version}
      onChange={(nextVersion) => {
        if (nextVersion === version) {
          return;
        }
        void navigate({
          to:
            view === "infractions" ? "/rules/$kind/$version/infractions" : "/rules/$kind/$version",
          params: { kind, version: nextVersion },
          search: { lang: language },
        });
      }}
      label={m.rules_version_label()}
      className={cn("text-muted-foreground", className)}
    />
  );
}

export function RulesDocumentSelects({
  kind,
  language,
  version,
  view,
  versions,
  englishVersions,
  className,
}: {
  kind: RuleKind;
  language: RuleLanguage;
  version: string;
  view: RulesView;
  versions: RuleVersionsListResponse;
  englishVersions: RuleVersionsListResponse;
  className?: string;
}) {
  const current = versions.versions.find((entry) => entry.version === version);
  const labels = ruleVersionLabels([...englishVersions.versions, ...versions.versions]);
  const items = versions.versions
    .toReversed()
    .map((entry) => ({ value: entry.version, label: labels.get(entry.version) }));
  return (
    <>
      <RulesLanguageSelect
        kind={kind}
        language={language}
        languages={versions.languages}
        versionLanguages={current?.languages ?? [language]}
        view={view}
        englishVersions={englishVersions}
        className={className}
      />
      <RulesVersionSelect
        kind={kind}
        language={language}
        version={version}
        items={items}
        fallbackLabel={labels.get(version)}
        view={view}
        className={className}
      />
    </>
  );
}

export function RulesSettingsSheet({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Drawer showSwipeHandle>
      <DrawerTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="text-muted-foreground shrink-0 md:hidden"
          />
        }
      >
        <span className="sr-only">{m.rules_settings_title()}</span> {label}
        <ChevronDownIcon data-icon="inline-end" />
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{m.rules_settings_title()}</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col items-start gap-3 px-4 pb-6">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}

export function RulesSearchBar({
  placeholder,
  trailing,
  className,
}: {
  placeholder: string;
  trailing?: string;
  className?: string;
}) {
  const urlQuery = useSearch({ strict: false, select: (search) => search.q });
  const urlValue = typeof urlQuery === "string" ? urlQuery : "";
  const setQuery = useRulesSearchStore((state) => state.setQuery);
  const resetSignal = useRulesSearchStore((state) => state.resetSignal);
  const navigate = useNavigate();
  const [resetPending, setResetPending] = useState(false);

  const [draft, setDraft] = useSearchUrlSync({
    urlValue,
    delay: 150,
    onCommit: (next) => {
      setQuery(next);
      const search = (prev: Record<string, unknown>) => ({
        ...prev,
        q: next === "" ? undefined : next,
      });
      if (resetPending) {
        setResetPending(false);
        // A reset can follow a raw history.pushState anchor jump the router has not seen.
        const hash = globalThis.location.hash.slice(1);
        void navigate({
          to: ".",
          search,
          hash: hash === "" ? undefined : hash,
          replace: true,
          resetScroll: false,
          hashScrollIntoView: false,
        });
        return;
      }
      void navigate({ to: ".", search, replace: true });
    },
  });

  useScopeEffect(urlValue, (query) => {
    setQuery(query);
  });

  // Gated on resetSignal, not the query value: during normal typing the store
  // is briefly empty until the debounce fires, which would wipe the draft.
  const [handledSignal, setHandledSignal] = useState(resetSignal);
  if (handledSignal !== resetSignal) {
    setHandledSignal(resetSignal);
    if (resetSignal > 0 && draft !== "") {
      setResetPending(true);
      setDraft("");
    }
  }

  return (
    <SearchInput
      value={draft}
      onValueChange={setDraft}
      placeholder={placeholder}
      aria-label={m.rules_search_placeholder()}
      trailing={trailing}
      className={cn("min-w-0 flex-1 md:min-w-[200px]", className)}
    />
  );
}

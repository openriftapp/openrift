import { enumLabel } from "@openrift/shared/enum-label";

import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { FilterIcon } from "@/features/cards/components/filter-icon";
import { useDeckListFilters } from "@/features/decks/hooks/use-deck-list-filters";
import { useDeckFormatList, useEnumOrders } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

// Visible only below `md`; the toolbar hides it above via CSS once the
// filter controls themselves are visible.
export function DeckActiveFilters() {
  const {
    search,
    formats,
    formatsExclude,
    validity,
    drafts,
    domains,
    domainsExclude,
    hasActiveFilters,
    setSearch,
    cycleFormat,
    setValidity,
    setDrafts,
    cycleDomain,
    clearAllFilters,
  } = useDeckListFilters();
  const { labels: formatLabels } = useDeckFormatList();
  const { labels: enumLabels } = useEnumOrders();

  if (!hasActiveFilters) {
    return null;
  }

  const chip = (
    key: string,
    label: string,
    excluded: boolean,
    onRemove: () => void,
    domain?: string,
  ) => (
    <FilterChip
      key={key}
      label={label}
      excluded={excluded}
      icon={
        domain === undefined ? undefined : (
          <FilterIcon category="domains" value={domain} className="size-3.5" />
        )
      }
      removeLabel={
        excluded
          ? m.decks_editor_stop_excluding({ label })
          : m.decks_editor_remove_filter({ label })
      }
      onRemove={onRemove}
    />
  );

  return (
    <div className="flex flex-wrap items-center gap-1">
      {search !== "" && (
        <FilterChip
          label={<>&ldquo;{search}&rdquo;</>}
          removeLabel={m.decks_editor_clear_search_filter()}
          onRemove={() => setSearch("")}
        />
      )}

      {formats.map((slug) =>
        chip(slug, enumLabel(formatLabels, slug), false, () => cycleFormat(slug)),
      )}
      {formatsExclude.map((slug) =>
        chip(`ex-${slug}`, enumLabel(formatLabels, slug), true, () => cycleFormat(slug)),
      )}

      {validity !== "all" &&
        chip("validity", m.decks_editor_filter_legal(), validity === "invalid", () =>
          setValidity("all"),
        )}

      {drafts !== "all" &&
        chip("drafts", m.decks_editor_filter_draft(), drafts === "hide", () => setDrafts("all"))}

      {domains.map((domain) =>
        chip(
          domain,
          enumLabel(enumLabels.domains, domain),
          false,
          () => cycleDomain(domain),
          domain,
        ),
      )}
      {domainsExclude.map((domain) =>
        chip(
          `ex-${domain}`,
          enumLabel(enumLabels.domains, domain),
          true,
          () => cycleDomain(domain),
          domain,
        ),
      )}

      <Button type="button" variant="ghost" size="sm" onClick={clearAllFilters}>
        {m.decks_editor_clear_all()}
      </Button>
    </div>
  );
}

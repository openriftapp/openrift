import type { Domain } from "@openrift/shared/types/enums";
import { getRouteApi } from "@tanstack/react-router";

import type { DeckListSearch } from "@/features/decks/lib/deck-list-search";
import type { DeckListDrafts, DeckListValidity } from "@/features/decks/lib/deck-list-utils";
import type { SignedFilterBinding } from "@/lib/filter-sign";
import { dimensionSign, flipSignedValues, toggleSignedValue } from "@/lib/filter-sign";

const routeApi = getRouteApi("/_app/decks/");

export interface DeckListFilterValues {
  search: string;
  formats: string[];
  formatsExclude: string[];
  validity: DeckListValidity;
  drafts: DeckListDrafts;
  domains: Domain[];
  domainsExclude: Domain[];
  folders: string[];
  foldersExclude: string[];
  showArchived: boolean;
  hasActiveFilters: boolean;
}

export interface DeckListFilterActions {
  setSearch: (value: string) => void;
  formatFilter: SignedFilterBinding;
  domainFilter: SignedFilterBinding;
  folderFilter: SignedFilterBinding;
  removeFormat: (value: string) => void;
  removeDomain: (value: string) => void;
  cycleValidity: () => void;
  setValidity: (value: DeckListValidity) => void;
  cycleDrafts: () => void;
  setDrafts: (value: DeckListDrafts) => void;
  setShowArchived: (value: boolean) => void;
  clearAllFilters: () => void;
}

const VALIDITY_CYCLE: Record<DeckListValidity, DeckListValidity> = {
  all: "valid",
  valid: "invalid",
  invalid: "all",
};

const DRAFTS_CYCLE: Record<DeckListDrafts, DeckListDrafts> = {
  all: "only",
  only: "hide",
  hide: "all",
};

export function useDeckListFilters(): DeckListFilterValues & DeckListFilterActions {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  const update = (patch: Partial<DeckListSearch>) => {
    void navigate({
      search: (prev) => {
        const next = { ...prev, ...patch };
        return Object.fromEntries(
          Object.entries(next).filter(([, value]) => {
            if (value === undefined || value === "" || value === false) {
              return false;
            }
            return !(Array.isArray(value) && value.length === 0);
          }),
        );
      },
    });
  };

  const domains = (search.domains ?? []) as Domain[];
  const domainsExclude = (search.domainsEx ?? []) as Domain[];
  const formats = search.formats ?? [];
  const formatsExclude = search.formatsEx ?? [];
  const folders = search.folders ?? [];
  const foldersExclude = search.foldersEx ?? [];
  const validity = search.validity ?? "all";
  const drafts = search.drafts ?? "all";

  const bind = (
    included: readonly string[],
    excluded: readonly string[],
    write: (next: { included: string[]; excluded: string[] }) => void,
  ): SignedFilterBinding => ({
    sign: dimensionSign(included, excluded),
    onSignedToggle: (value, sign) => write(toggleSignedValue(included, excluded, value, sign)),
    onSignFlip: () => write(flipSignedValues(included, excluded)),
  });
  const writeFormats = (next: { included: string[]; excluded: string[] }) =>
    update({ formats: next.included, formatsEx: next.excluded });
  const writeDomains = (next: { included: string[]; excluded: string[] }) =>
    update({ domains: next.included as Domain[], domainsEx: next.excluded as Domain[] });
  const writeFolders = (next: { included: string[]; excluded: string[] }) =>
    update({ folders: next.included, foldersEx: next.excluded });

  return {
    search: search.search ?? "",
    formats,
    formatsExclude,
    validity,
    drafts,
    domains,
    domainsExclude,
    folders,
    foldersExclude,
    showArchived: search.archived ?? false,
    hasActiveFilters:
      (search.search ?? "") !== "" ||
      formats.length > 0 ||
      formatsExclude.length > 0 ||
      validity !== "all" ||
      drafts !== "all" ||
      domains.length > 0 ||
      domainsExclude.length > 0 ||
      folders.length > 0 ||
      foldersExclude.length > 0,

    setSearch: (value) => update({ search: value }),
    formatFilter: bind(formats, formatsExclude, writeFormats),
    domainFilter: bind(domains, domainsExclude, writeDomains),
    folderFilter: bind(folders, foldersExclude, writeFolders),
    removeFormat: (value) =>
      writeFormats({
        included: formats.filter((entry) => entry !== value),
        excluded: formatsExclude.filter((entry) => entry !== value),
      }),
    removeDomain: (value) =>
      writeDomains({
        included: domains.filter((entry) => entry !== value),
        excluded: domainsExclude.filter((entry) => entry !== value),
      }),
    setValidity: (value) => update({ validity: value === "all" ? undefined : value }),
    cycleValidity: () => {
      const next = VALIDITY_CYCLE[validity];
      update({ validity: next === "all" ? undefined : next });
    },
    setDrafts: (value) => update({ drafts: value === "all" ? undefined : value }),
    cycleDrafts: () => {
      const next = DRAFTS_CYCLE[drafts];
      update({ drafts: next === "all" ? undefined : next });
    },
    setShowArchived: (value) => update({ archived: value }),
    clearAllFilters: () =>
      update({
        search: undefined,
        formats: undefined,
        formatsEx: undefined,
        validity: undefined,
        drafts: undefined,
        domains: undefined,
        domainsEx: undefined,
        folders: undefined,
        foldersEx: undefined,
      }),
  };
}

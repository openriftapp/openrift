import { nextScopeSearch } from "@/features/meta/lib/meta-scope";

type SearchUpdate = (prev: Record<string, unknown>) => Record<string, unknown>;

export function metaIndexSearchWriter(
  write: (search: SearchUpdate, replace: boolean) => void,
  options: { resetPage: boolean },
): {
  setSearchParams: (patch: Record<string, unknown>, replace?: boolean) => void;
  commitQuery: (value: string) => void;
} {
  const setSearchParams = (patch: Record<string, unknown>, replace = false) =>
    write(
      (prev) => nextScopeSearch(options.resetPage ? { ...prev, page: undefined } : prev, patch),
      replace,
    );
  return {
    setSearchParams,
    // Typing commits on every pause, so search replaces the entry instead of stacking Back steps.
    commitQuery: (value) => setSearchParams({ q: value === "" ? undefined : value }, true),
  };
}

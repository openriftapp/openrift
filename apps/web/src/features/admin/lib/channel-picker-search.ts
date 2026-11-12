import { foldForSearch } from "@openrift/shared/search-fold";

export interface ChannelSearchOption {
  id: string;
  slug: string;
  label: string;
  breadcrumb: string;
  parentId: string | null;
}

function rank(option: ChannelSearchOption, query: string): number {
  const label = foldForSearch(option.label);
  const slug = foldForSearch(option.slug);
  const breadcrumb = foldForSearch(option.breadcrumb);
  if (label === query || slug === query) {
    return 0;
  }
  if (label.startsWith(query) || slug.startsWith(query)) {
    return 1;
  }
  if (label.includes(query) || slug.includes(query)) {
    return 2;
  }
  return breadcrumb.includes(query) ? 3 : -1;
}

export function searchChannelOptions(
  options: readonly ChannelSearchOption[],
  query: string,
  limit = 8,
): ChannelSearchOption[] {
  const needle = foldForSearch(query);
  if (needle.length === 0) {
    return options.slice(0, limit);
  }
  return options
    .map((option) => ({ option, score: rank(option, needle) }))
    .filter((entry) => entry.score >= 0)
    .toSorted((a, b) => a.score - b.score || a.option.breadcrumb.localeCompare(b.option.breadcrumb))
    .slice(0, limit)
    .map((entry) => entry.option);
}

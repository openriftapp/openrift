import { ComboboxPicker } from "@/components/combobox-picker";
import { useCustomTagList } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

interface TagMultiSelectProps {
  category: string;
  nounPlural: string;
  selected: string[];
  onChange: (next: string[]) => void;
  triggerId: string;
  triggerClassName?: string;
}

/** State for "empty category" is left to the caller — render a fallback above this before mounting it. */
export function TagMultiSelect({
  category,
  nounPlural,
  selected,
  onChange,
  triggerId,
  triggerClassName,
}: TagMultiSelectProps) {
  const { byCategory } = useCustomTagList();
  const tags = byCategory.get(category) ?? [];

  return (
    <ComboboxPicker
      multiple
      id={triggerId}
      options={tags.map((tag) => ({ value: tag.slug, label: tag.label }))}
      value={selected}
      onChange={onChange}
      placeholder={m.decks_format_tag_multi_placeholder({ nounPlural })}
      searchPlaceholder={m.decks_format_tag_multi_search({ nounPlural })}
      emptyText={m.decks_format_tag_multi_empty({ nounPlural })}
      className={triggerClassName ?? "w-72"}
      contentClassName="w-(--anchor-width) min-w-72"
    />
  );
}

export function useCategoryTagSlugs(category: string): string[] {
  const { byCategory } = useCustomTagList();
  return (byCategory.get(category) ?? []).map((tag) => tag.slug);
}

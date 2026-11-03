import { tagGroupOf } from "@/features/collections/lib/tag-category-groups";
import { useCustomTagList, useTagCategories } from "@/hooks/use-enums";

export function useTagGroupResolvers(): {
  tagGroup: (tag: string) => string;
  customTagGroup: (slug: string) => string | undefined;
} {
  const { categories, categoryByTag } = useTagCategories();
  const { all } = useCustomTagList();
  const categoryBySlug = new Map(all.map((tag) => [tag.slug, tag.category]));
  return {
    tagGroup: tagGroupOf(categories, categoryByTag),
    customTagGroup: (slug) => categoryBySlug.get(slug),
  };
}

import type { CustomTagCategoryResponse } from "@openrift/shared/types/api/admin";

import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { CardTagEditor } from "@/features/admin/components/card-tag-editor";
import { BulkImport } from "@/features/admin/components/custom-tags-bulk-import";
import { TagsSection } from "@/features/admin/components/custom-tags-section";
import { TagCategoriesTable } from "@/features/admin/components/tag-categories-table";
import {
  useCreateCustomTagCategory,
  useCustomTagCategories,
  useCustomTags,
  useDeleteCustomTagCategory,
  useUpdateCustomTagCategory,
} from "@/features/collections/hooks/use-custom-tags";

function CustomTagCategoriesSection({ categories }: { categories: CustomTagCategoryResponse[] }) {
  const createMutation = useCreateCustomTagCategory({ inlineError: true });
  const updateMutation = useUpdateCustomTagCategory({ inlineError: true });
  const deleteMutation = useDeleteCustomTagCategory();
  return (
    <TagCategoriesTable
      categories={categories}
      slugExample="region"
      labelExample="Region"
      emptyText="No categories yet — create one before adding tags."
      description="Namespaces custom tags per deck-builder format. Delete is blocked while tags reference the category."
      onCreate={(input) => createMutation.mutateAsync(input)}
      onUpdate={(input) => updateMutation.mutateAsync(input)}
      onDelete={(id) => deleteMutation.mutateAsync(id)}
    />
  );
}

export function CustomTagsPage() {
  const { data: tagsData } = useCustomTags();
  const { data: categoriesData } = useCustomTagCategories();
  const tags = tagsData.tags;
  const categories = categoriesData.categories;

  return (
    <div className="space-y-8">
      <AdminPageTopBar title="Custom Tags" />
      <CustomTagCategoriesSection categories={categories} />

      <TagsSection tags={tags} categories={categories} />

      <CardTagEditor tags={tags} />

      <BulkImport tags={tags} />
    </div>
  );
}

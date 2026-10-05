import type { CustomTagCategoryResponse } from "@openrift/shared/types/api/admin";

import { PageDescription } from "@/components/layout/page-top-bar";
import {
  DescriptionCell,
  DescriptionInput,
  DraftTextInput,
  LabelCell,
  SlugAddInput,
  SlugCell,
  validateSlugAndLabel,
} from "@/features/admin/components/admin-crud-shared";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import type { CustomTagCategoryDraft } from "@/features/admin/lib/custom-tags-drafts";
import {
  useCreateCustomTagCategory,
  useDeleteCustomTagCategory,
  useUpdateCustomTagCategory,
} from "@/features/collections/hooks/use-custom-tags";

function CategoryTagCountCell({ row }: AdminCellSlotProps<CustomTagCategoryResponse>) {
  if (!row) {
    return null;
  }
  return <span className="font-mono text-sm">{row.tagCount}</span>;
}

const categoryColumns: AdminColumnDef<CustomTagCategoryResponse, CustomTagCategoryDraft>[] = [
  {
    header: "Slug",
    sortValue: (cat) => cat.slug,
    cell: <SlugCell<CustomTagCategoryResponse> />,
    addCell: <SlugAddInput<CustomTagCategoryDraft> placeholder="region" width="w-48" />,
  },
  {
    header: "Label",
    sortValue: (cat) => cat.label,
    cell: <LabelCell<CustomTagCategoryResponse> />,
    editCell: <DraftTextInput<CustomTagCategoryDraft> field="label" />,
    addCell: <DraftTextInput<CustomTagCategoryDraft> field="label" placeholder="Region" />,
  },
  {
    header: "Description",
    sortValue: (cat) => cat.description ?? "",
    cell: <DescriptionCell<CustomTagCategoryResponse> />,
    editCell: <DescriptionInput<CustomTagCategoryDraft> />,
    addCell: <DescriptionInput<CustomTagCategoryDraft> />,
  },
  {
    header: "Tags",
    sortValue: (cat) => cat.tagCount,
    align: "right",
    cell: <CategoryTagCountCell />,
  },
];

export function CategoriesSection({ categories }: { categories: CustomTagCategoryResponse[] }) {
  const createMutation = useCreateCustomTagCategory();
  const updateMutation = useUpdateCustomTagCategory();
  const deleteMutation = useDeleteCustomTagCategory();

  return (
    <AdminTable
      columns={categoryColumns}
      data={categories}
      getRowKey={(cat) => cat.id}
      emptyText="No categories yet — create one before adding tags."
      toolbar={
        <PageDescription>
          Namespaces custom tags per deck-builder format. Delete is blocked while tags reference the
          category.
        </PageDescription>
      }
      add={{
        emptyDraft: { id: "", slug: "", label: "", description: "" },
        onSave: (d) =>
          createMutation.mutateAsync({
            slug: d.slug.trim(),
            label: d.label.trim(),
            description: d.description.trim() || null,
          }),
        validate: (d) => validateSlugAndLabel(d.slug, d.label, "region"),
        label: "Add Category",
      }}
      edit={{
        toDraft: (cat) => ({
          id: cat.id,
          slug: cat.slug,
          label: cat.label,
          description: cat.description ?? "",
        }),
        onSave: (d) =>
          updateMutation.mutateAsync({
            id: d.id,
            slug: d.slug.trim() || undefined,
            label: d.label.trim() || undefined,
            description: d.description.trim() || null,
          }),
      }}
      delete={{
        onDelete: (cat) => deleteMutation.mutateAsync(cat.id),
      }}
    />
  );
}

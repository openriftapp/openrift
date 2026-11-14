import { PageDescription } from "@/components/layout/page-top-bar";
import {
  CountCell,
  DescriptionCell,
  DescriptionInput,
  DraftTextInput,
  LabelCell,
  SlugAddInput,
  SlugCell,
  validateSlugAndLabel,
} from "@/features/admin/components/admin-crud-shared";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminColumnDef } from "@/features/admin/components/admin-table";

interface TagCategoryRow {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  tagCount: number;
}

interface TagCategoryDraft {
  id: string;
  slug: string;
  label: string;
  description: string;
}

function categoryColumns<T extends TagCategoryRow>(
  slugExample: string,
  labelExample: string,
): AdminColumnDef<T, TagCategoryDraft>[] {
  return [
    {
      header: "Slug",
      sortValue: (cat) => cat.slug,
      cell: <SlugCell<T> />,
      addCell: <SlugAddInput<TagCategoryDraft> placeholder={slugExample} width="w-48" />,
    },
    {
      header: "Label",
      sortValue: (cat) => cat.label,
      cell: <LabelCell<T> />,
      editCell: <DraftTextInput<TagCategoryDraft> field="label" />,
      addCell: <DraftTextInput<TagCategoryDraft> field="label" placeholder={labelExample} />,
    },
    {
      header: "Description",
      sortValue: (cat) => cat.description ?? "",
      cell: <DescriptionCell<T> />,
      editCell: <DescriptionInput<TagCategoryDraft> />,
      addCell: <DescriptionInput<TagCategoryDraft> />,
    },
    {
      header: "Tags",
      sortValue: (cat) => cat.tagCount,
      align: "right",
      cell: <CountCell<T> count={(row) => row.tagCount} />,
    },
  ];
}

export function TagCategoriesTable<T extends TagCategoryRow>({
  categories,
  slugExample,
  labelExample,
  emptyText,
  description,
  onCreate,
  onUpdate,
  onDelete,
}: {
  categories: T[];
  slugExample: string;
  labelExample: string;
  emptyText: string;
  description: string;
  onCreate: (input: {
    slug: string;
    label: string;
    description: string | null;
  }) => Promise<unknown>;
  onUpdate: (input: {
    id: string;
    slug?: string;
    label?: string;
    description: string | null;
  }) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  return (
    <AdminTable
      columns={categoryColumns<T>(slugExample, labelExample)}
      data={categories}
      getRowKey={(cat) => cat.id}
      emptyText={emptyText}
      toolbar={<PageDescription>{description}</PageDescription>}
      add={{
        emptyDraft: { id: "", slug: "", label: "", description: "" },
        onSave: (d) =>
          onCreate({
            slug: d.slug.trim(),
            label: d.label.trim(),
            description: d.description.trim() || null,
          }),
        validate: (d) => validateSlugAndLabel(d.slug, d.label, slugExample),
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
          onUpdate({
            id: d.id,
            slug: d.slug.trim() || undefined,
            label: d.label.trim() || undefined,
            description: d.description.trim() || null,
          }),
      }}
      delete={{
        onDelete: (cat) => onDelete(cat.id),
      }}
    />
  );
}

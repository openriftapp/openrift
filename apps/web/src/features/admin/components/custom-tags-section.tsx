import type {
  CustomTagCategoryResponse,
  CustomTagResponse,
} from "@openrift/shared/types/api/admin";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import {
  DescriptionInput,
  DraftTextInput,
  SlugAddInput,
} from "@/features/admin/components/admin-crud-shared";
import { AdminTable } from "@/features/admin/components/admin-table";
import type {
  AdminCellSlotProps,
  AdminColumnDef,
  AdminDraftSlotProps,
} from "@/features/admin/components/admin-table";
import { CategorySelect } from "@/features/admin/components/card-tag-editor";
import { isValidSlug } from "@/features/admin/lib/admin-slug";
import type { CustomTagDraft } from "@/features/admin/lib/custom-tags-drafts";
import {
  useClearCustomTagCards,
  useCreateCustomTag,
  useDeleteCustomTag,
  useUpdateCustomTag,
} from "@/features/collections/hooks/use-custom-tags";

function TagSlugCell({ row }: AdminCellSlotProps<CustomTagResponse>) {
  if (!row) {
    return null;
  }
  return <span className="font-mono text-sm">{row.slug}</span>;
}

function TagLabelCell({ row }: AdminCellSlotProps<CustomTagResponse>) {
  if (!row) {
    return null;
  }
  return <span>{row.label}</span>;
}

function TagCategoryCell({ row }: AdminCellSlotProps<CustomTagResponse>) {
  if (!row) {
    return null;
  }
  return <span>{row.categoryLabel}</span>;
}

function TagDescriptionCell({ row }: AdminCellSlotProps<CustomTagResponse>) {
  if (!row) {
    return null;
  }
  return (
    <span
      className="text-muted-foreground block max-w-xs truncate"
      title={row.description ?? undefined}
    >
      {row.description ?? "—"}
    </span>
  );
}

function TagCardCountCell({ row }: AdminCellSlotProps<CustomTagResponse>) {
  if (!row) {
    return null;
  }
  return <span className="font-mono text-sm">{row.cardCount}</span>;
}

interface TagCategorySelectProps extends AdminDraftSlotProps<CustomTagDraft> {
  items: { value: string; label: string }[];
}

function TagCategorySelect({ draft, setDraft, items }: TagCategorySelectProps) {
  if (!draft || !setDraft) {
    return null;
  }
  return (
    <CategorySelect
      items={items}
      value={draft.categoryId}
      onChange={(id) => setDraft((prev) => ({ ...prev, categoryId: id }))}
    />
  );
}

/** `row` is injected by AdminTable via cloneElement. */
export function TagClearCardsAction({
  row,
  onClear,
}: AdminCellSlotProps<CustomTagResponse> & {
  onClear?: (tag: CustomTagResponse) => Promise<unknown>;
}) {
  if (!row || !onClear || row.cardCount === 0) {
    return null;
  }
  return (
    <ConfirmActionButton
      title={`Clear “${row.label}”?`}
      description={`Removes this tag from ${row.cardCount === 1 ? "its 1 card" : `all ${row.cardCount} cards`}. The tag itself is kept, so it can be filled again later.`}
      confirmLabel="Clear"
      onConfirm={() => onClear(row)}
      trigger={<Button variant="ghost" />}
    >
      Clear
    </ConfirmActionButton>
  );
}

export function TagsSection({
  tags,
  categories,
}: {
  tags: CustomTagResponse[];
  categories: CustomTagCategoryResponse[];
}) {
  const createMutation = useCreateCustomTag();
  const updateMutation = useUpdateCustomTag();
  const deleteMutation = useDeleteCustomTag();
  const clearMutation = useClearCustomTagCards();

  const defaultCategoryId = categories[0]?.id ?? "";
  const categoryItems = categories.map((cat) => ({ value: cat.id, label: cat.label }));

  const columns: AdminColumnDef<CustomTagResponse, CustomTagDraft>[] = [
    {
      header: "Slug",
      sortValue: (t) => t.slug,
      cell: <TagSlugCell />,
      addCell: <SlugAddInput<CustomTagDraft> placeholder="bandle-city" width="w-48" />,
    },
    {
      header: "Label",
      sortValue: (t) => t.label,
      cell: <TagLabelCell />,
      editCell: <DraftTextInput<CustomTagDraft> field="label" />,
      addCell: <DraftTextInput<CustomTagDraft> field="label" placeholder="Bandle City" />,
    },
    {
      header: "Category",
      sortValue: (t) => t.categoryLabel,
      cell: <TagCategoryCell />,
      editCell: <TagCategorySelect items={categoryItems} />,
      addCell: <TagCategorySelect items={categoryItems} />,
    },
    {
      header: "Description",
      sortValue: (t) => t.description ?? "",
      cell: <TagDescriptionCell />,
      editCell: <DescriptionInput<CustomTagDraft> />,
      addCell: <DescriptionInput<CustomTagDraft> />,
    },
    {
      header: "Cards",
      sortValue: (t) => t.cardCount,
      align: "right",
      cell: <TagCardCountCell />,
    },
  ];

  return (
    <AdminTable
      columns={columns}
      data={tags}
      getRowKey={(t) => t.id}
      emptyText="No custom tags yet."
      toolbar={
        <p className="text-muted-foreground">
          Admin-curated supplemental tags attachable to any card. Used by custom deck-builder
          formats (e.g. region-locked freeform). Pick a category to scope the tag to one format.
        </p>
      }
      add={{
        emptyDraft: { id: "", slug: "", label: "", categoryId: defaultCategoryId, description: "" },
        onSave: (d) =>
          createMutation.mutateAsync({
            slug: d.slug.trim(),
            label: d.label.trim(),
            categoryId: d.categoryId,
            description: d.description.trim() || null,
          }),
        validate: (d) => {
          const slug = d.slug.trim();
          const label = d.label.trim();
          if (!slug || !label) {
            return "Slug and label are required";
          }
          if (!d.categoryId) {
            return "Pick a category (create one first if none exist)";
          }
          if (!isValidSlug(slug)) {
            return "Slug must be kebab-case (e.g. bandle-city)";
          }
          return null;
        },
        label: "Add Custom Tag",
      }}
      edit={{
        toDraft: (t) => ({
          id: t.id,
          slug: t.slug,
          label: t.label,
          categoryId: t.categoryId,
          description: t.description ?? "",
        }),
        onSave: (d) =>
          updateMutation.mutateAsync({
            id: d.id,
            label: d.label.trim() || undefined,
            categoryId: d.categoryId || undefined,
            description: d.description.trim() || null,
          }),
      }}
      delete={{
        onDelete: (t) => deleteMutation.mutateAsync(t.id),
      }}
      actions={<TagClearCardsAction onClear={(t) => clearMutation.mutateAsync(t.id)} />}
    />
  );
}

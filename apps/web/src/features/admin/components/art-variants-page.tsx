import { PageDescription } from "@/components/layout/page-top-bar";
import {
  DraftTextInput,
  LabelCell,
  SlugAddInput,
  SlugCell,
  validateSlugAndLabel,
  WellKnownCell,
} from "@/features/admin/components/admin-crud-shared";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminColumnDef } from "@/features/admin/components/admin-table";
import {
  useArtVariants,
  useCreateArtVariant,
  useDeleteArtVariant,
  useReorderArtVariants,
  useUpdateArtVariant,
} from "@/features/admin/hooks/use-art-variants";
import { flatReorder } from "@/features/admin/lib/admin-reorder";

interface ArtVariantRow {
  slug: string;
  label: string;
  sortOrder: number;
  isWellKnown: boolean;
}

interface ArtVariantDraft {
  slug: string;
  label: string;
}

const columns: AdminColumnDef<ArtVariantRow, ArtVariantDraft>[] = [
  {
    header: "Slug",
    sortValue: (artVariant) => artVariant.slug,
    cell: <SlugCell<ArtVariantRow> />,
    addCell: <SlugAddInput<ArtVariantDraft> placeholder="alternate" />,
  },
  {
    header: "Label",
    sortValue: (artVariant) => artVariant.label,
    cell: <LabelCell<ArtVariantRow> />,
    editCell: <DraftTextInput<ArtVariantDraft> field="label" />,
    addCell: <DraftTextInput<ArtVariantDraft> field="label" placeholder="Alternate Art" />,
  },
  {
    header: "Well-known",
    cell: <WellKnownCell<ArtVariantRow> />,
  },
];

export function ArtVariantsPage() {
  const { data } = useArtVariants();
  const createMutation = useCreateArtVariant();
  const updateMutation = useUpdateArtVariant();
  const deleteMutation = useDeleteArtVariant();
  const reorderMutation = useReorderArtVariants();
  const { artVariants } = data;

  return (
    <AdminTable
      columns={columns}
      data={artVariants}
      getRowKey={(artVariant) => artVariant.slug}
      emptyText="No art variants yet."
      topBar={(actions) => <AdminPageTopBar title="Art Variants" actions={actions} />}
      toolbar={
        <PageDescription>
          Art variants describe alternate artwork treatments for a printing (e.g. Normal, Alternate,
          Extended).
        </PageDescription>
      }
      add={{
        emptyDraft: { slug: "", label: "" },
        onSave: (draft) =>
          createMutation.mutateAsync({
            slug: draft.slug.trim(),
            label: draft.label.trim(),
          }),
        validate: (draft) =>
          validateSlugAndLabel(draft.slug, draft.label, "alternate, extended-art"),
        label: "Add Art Variant",
      }}
      edit={{
        toDraft: (artVariant) => ({
          slug: artVariant.slug,
          label: artVariant.label,
        }),
        onSave: (draft) =>
          updateMutation.mutateAsync({
            slug: draft.slug,
            label: draft.label.trim() || undefined,
          }),
      }}
      reorder={{
        moves: flatReorder(artVariants, (variant) => variant.slug),
        onReorder: (keys) => reorderMutation.mutateAsync(keys),
        isPending: reorderMutation.isPending,
      }}
      export={{
        filename: "art-variants.json",
        transform: (rows) => rows.map(({ isWellKnown: _isWellKnown, ...rest }) => rest),
      }}
      delete={{
        onDelete: (artVariant) => deleteMutation.mutateAsync(artVariant.slug),
      }}
    />
  );
}

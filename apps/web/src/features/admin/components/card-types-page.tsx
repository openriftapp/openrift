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
import { flatReorder } from "@/features/admin/lib/admin-reorder";
import {
  useCardTypes,
  useCreateCardType,
  useDeleteCardType,
  useReorderCardTypes,
  useUpdateCardType,
} from "@/features/cards/hooks/use-card-types";

interface CardTypeRow {
  slug: string;
  label: string;
  sortOrder: number;
  isWellKnown: boolean;
}

interface CardTypeDraft {
  slug: string;
  label: string;
}

const columns: AdminColumnDef<CardTypeRow, CardTypeDraft>[] = [
  {
    header: "Slug",
    sortValue: (cardType) => cardType.slug,
    cell: <SlugCell<CardTypeRow> />,
    addCell: <SlugAddInput<CardTypeDraft> placeholder="unit" />,
  },
  {
    header: "Label",
    sortValue: (cardType) => cardType.label,
    cell: <LabelCell<CardTypeRow> />,
    editCell: <DraftTextInput<CardTypeDraft> field="label" />,
    addCell: <DraftTextInput<CardTypeDraft> field="label" placeholder="Unit" />,
  },
  {
    header: "Well-known",
    cell: <WellKnownCell<CardTypeRow> />,
  },
];

export function CardTypesPage() {
  const { data } = useCardTypes();
  const createMutation = useCreateCardType();
  const updateMutation = useUpdateCardType();
  const deleteMutation = useDeleteCardType();
  const reorderMutation = useReorderCardTypes();
  const { cardTypes } = data;

  return (
    <AdminTable
      columns={columns}
      data={cardTypes}
      getRowKey={(cardType) => cardType.slug}
      emptyText="No card types yet."
      topBar={(actions) => <AdminPageTopBar title="Card Types" actions={actions} />}
      toolbar={
        <PageDescription>
          Card types categorize cards by their game role (e.g. Unit, Spell, Battlefield, Legend,
          Rune).
        </PageDescription>
      }
      add={{
        emptyDraft: { slug: "", label: "" },
        onSave: (draft) =>
          createMutation.mutateAsync({
            slug: draft.slug.trim(),
            label: draft.label.trim(),
          }),
        validate: (draft) => validateSlugAndLabel(draft.slug, draft.label, "unit, battlefield"),
        label: "Add Card Type",
      }}
      edit={{
        toDraft: (cardType) => ({
          slug: cardType.slug,
          label: cardType.label,
        }),
        onSave: (draft) =>
          updateMutation.mutateAsync({
            slug: draft.slug,
            label: draft.label.trim() || undefined,
          }),
      }}
      reorder={{
        moves: flatReorder(cardTypes, (cardType) => cardType.slug),
        onReorder: (keys) => reorderMutation.mutateAsync(keys),
        isPending: reorderMutation.isPending,
      }}
      export={{
        filename: "card-types.json",
        transform: (rows) => rows.map(({ isWellKnown: _isWellKnown, ...rest }) => rest),
      }}
      delete={{
        onDelete: (cardType) => deleteMutation.mutateAsync(cardType.slug),
      }}
    />
  );
}

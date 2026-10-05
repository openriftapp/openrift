import { PageDescription } from "@/components/layout/page-top-bar";
import { DraftTextInput, LabelCell, SlugCell } from "@/features/admin/components/admin-crud-shared";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminColumnDef } from "@/features/admin/components/admin-table";
import { flatReorder } from "@/features/admin/lib/admin-reorder";
import {
  useDeckZones,
  useReorderDeckZones,
  useUpdateDeckZone,
} from "@/features/decks/hooks/use-deck-zones";

interface DeckZoneRow {
  slug: string;
  label: string;
  sortOrder: number;
  isWellKnown: boolean;
}

interface DeckZoneDraft {
  slug: string;
  label: string;
}

const columns: AdminColumnDef<DeckZoneRow, DeckZoneDraft>[] = [
  {
    header: "Slug",
    sortValue: (zone) => zone.slug,
    cell: <SlugCell<DeckZoneRow> />,
  },
  {
    header: "Label",
    sortValue: (zone) => zone.label,
    cell: <LabelCell<DeckZoneRow> />,
    editCell: <DraftTextInput<DeckZoneDraft> field="label" />,
  },
];

export function DeckZonesPage() {
  const { data } = useDeckZones();
  const updateMutation = useUpdateDeckZone();
  const reorderMutation = useReorderDeckZones();
  const { deckZones } = data;

  return (
    <AdminTable
      columns={columns}
      data={deckZones}
      getRowKey={(zone) => zone.slug}
      emptyText="No deck zones."
      topBar={(actions) => <AdminPageTopBar title="Deck Zones" actions={actions} />}
      toolbar={
        <PageDescription>
          Order here is the display order in the deck builder and imports.
        </PageDescription>
      }
      edit={{
        toDraft: (zone) => ({ slug: zone.slug, label: zone.label }),
        onSave: (draft) =>
          updateMutation.mutateAsync({
            slug: draft.slug,
            label: draft.label.trim() || undefined,
          }),
      }}
      reorder={{
        moves: flatReorder(deckZones, (zone) => zone.slug),
        onReorder: (keys) => reorderMutation.mutateAsync(keys),
        isPending: reorderMutation.isPending,
      }}
    />
  );
}

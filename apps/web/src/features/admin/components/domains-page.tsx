import {
  ColorCell,
  ColorInput,
  ColorPreviewCell,
  DraftTextInput,
  LabelCell,
  SlugAddInput,
  SlugCell,
  validateHexColor,
  validateSlugAndLabel,
  WellKnownCell,
} from "@/features/admin/components/admin-crud-shared";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminColumnDef } from "@/features/admin/components/admin-table";
import {
  useCreateDomain,
  useDeleteDomain,
  useDomains,
  useReorderDomains,
  useUpdateDomain,
} from "@/features/admin/hooks/use-domains";
import { flatReorder } from "@/features/admin/lib/admin-reorder";

interface DomainRow {
  slug: string;
  label: string;
  sortOrder: number;
  isWellKnown: boolean;
  color: string | null;
}

interface DomainDraft {
  slug: string;
  label: string;
  color: string;
}

const columns: AdminColumnDef<DomainRow, DomainDraft>[] = [
  {
    header: "Slug",
    width: "w-40",
    sortValue: (domain) => domain.slug,
    cell: <SlugCell<DomainRow> />,
    addCell: <SlugAddInput<DomainDraft> placeholder="new-domain" />,
  },
  {
    header: "Label",
    width: "w-40",
    sortValue: (domain) => domain.label,
    cell: <LabelCell<DomainRow> />,
    editCell: <DraftTextInput<DomainDraft> field="label" />,
    addCell: <DraftTextInput<DomainDraft> field="label" placeholder="New Domain" />,
  },
  {
    header: "Color",
    width: "w-36",
    cell: <ColorCell<DomainRow> />,
    editCell: <ColorInput<DomainDraft> placeholder="#CB212D" />,
    addCell: <ColorInput<DomainDraft> placeholder="#CB212D" />,
  },
  {
    header: "Preview",
    width: "w-28",
    cell: <ColorPreviewCell<DomainRow> />,
  },
  {
    header: "Well-known",
    width: "w-24",
    cell: <WellKnownCell<DomainRow> />,
  },
];

export function DomainsPage() {
  const { data } = useDomains();
  const createMutation = useCreateDomain();
  const updateMutation = useUpdateDomain();
  const deleteMutation = useDeleteDomain();
  const reorderMutation = useReorderDomains();
  const { domains } = data;

  return (
    <AdminTable
      columns={columns}
      data={domains}
      getRowKey={(domain) => domain.slug}
      emptyText="No domains yet."
      topBar={(actions) => <AdminPageTopBar title="Domains" actions={actions} />}
      add={{
        emptyDraft: { slug: "", label: "", color: "#737373" },
        onSave: (draft) =>
          createMutation.mutateAsync({
            slug: draft.slug.trim(),
            label: draft.label.trim(),
            color: draft.color.trim() || null,
          }),
        validate: (draft) =>
          validateSlugAndLabel(draft.slug, draft.label, "new-domain") ??
          validateHexColor(draft.color, "#CB212D"),
        label: "Add Domain",
      }}
      edit={{
        toDraft: (domain) => ({
          slug: domain.slug,
          label: domain.label,
          color: domain.color ?? "",
        }),
        onSave: (draft) =>
          updateMutation.mutateAsync({
            slug: draft.slug,
            label: draft.label.trim() || undefined,
            color: draft.color.trim() || null,
          }),
      }}
      reorder={{
        moves: flatReorder(domains, (domain) => domain.slug),
        onReorder: (keys) => reorderMutation.mutateAsync(keys),
        isPending: reorderMutation.isPending,
      }}
      export={{
        filename: "domains.json",
        transform: (rows) => rows.map(({ isWellKnown: _isWellKnown, ...rest }) => rest),
      }}
      delete={{
        onDelete: (domain) => deleteMutation.mutateAsync(domain.slug),
      }}
    />
  );
}

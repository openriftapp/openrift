import type { LanguageResponse } from "@openrift/shared/types/api/admin";

import { languageChipStyle } from "@/components/language-chip";
import { PageDescription } from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import {
  ColorCell,
  ColorInput,
  DraftTextInput,
  validateHexColor,
} from "@/features/admin/components/admin-crud-shared";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import {
  useCreateLanguage,
  useDeleteLanguage,
  useLanguages,
  useReorderLanguages,
  useUpdateLanguage,
} from "@/features/admin/hooks/use-languages";
import { flatReorder } from "@/features/admin/lib/admin-reorder";

interface LanguageDraft {
  code: string;
  name: string;
  color: string;
}

function CodeCell({ row }: AdminCellSlotProps<LanguageResponse>) {
  if (!row) {
    return null;
  }
  return <span className="font-mono text-sm">{row.code}</span>;
}

function NameCell({ row }: AdminCellSlotProps<LanguageResponse>) {
  if (!row) {
    return null;
  }
  return <span className="text-sm">{row.name}</span>;
}

function PreviewCell({ row }: AdminCellSlotProps<LanguageResponse>) {
  if (!row) {
    return null;
  }
  // Previews the admin-entered color directly (not the /init-derived chip) so a
  // freshly-saved color shows immediately, before /init refetches.
  return (
    <Badge className="font-mono" style={languageChipStyle(row.color)}>
      {row.code}
    </Badge>
  );
}

const columns: AdminColumnDef<LanguageResponse, LanguageDraft>[] = [
  {
    header: "Code",
    sortValue: (lang) => lang.code,
    cell: <CodeCell />,
    addCell: (
      <DraftTextInput<LanguageDraft>
        field="code"
        placeholder="EN"
        letterCase="upper"
        className="w-24 font-mono"
      />
    ),
  },
  {
    header: "Name",
    sortValue: (lang) => lang.name,
    cell: <NameCell />,
    editCell: <DraftTextInput<LanguageDraft> field="name" placeholder="English" />,
    addCell: <DraftTextInput<LanguageDraft> field="name" placeholder="English" />,
  },
  {
    header: "Color",
    width: "w-36",
    cell: <ColorCell<LanguageResponse> />,
    editCell: <ColorInput<LanguageDraft> placeholder="#1D4ED8" />,
    addCell: <ColorInput<LanguageDraft> placeholder="#1D4ED8" />,
  },
  {
    header: "Preview",
    width: "w-24",
    cell: <PreviewCell />,
  },
];

export function LanguagesPage() {
  const { data } = useLanguages();
  const createMutation = useCreateLanguage();
  const updateMutation = useUpdateLanguage();
  const deleteMutation = useDeleteLanguage();
  const reorderMutation = useReorderLanguages();
  const { languages } = data;

  return (
    <AdminTable
      columns={columns}
      data={languages}
      getRowKey={(lang) => lang.code}
      emptyText="No languages yet."
      topBar={(actions) => <AdminPageTopBar title="Languages" actions={actions} />}
      toolbar={
        <PageDescription>The color appears on each printing&apos;s language chip.</PageDescription>
      }
      add={{
        emptyDraft: { code: "", name: "", color: "#1D4ED8" },
        onSave: (draft) =>
          createMutation.mutateAsync({
            code: draft.code.trim(),
            name: draft.name.trim(),
            color: draft.color.trim() || null,
          }),
        validate: (draft) => {
          const code = draft.code.trim();
          const name = draft.name.trim();
          if (!code || !name) {
            return "Code and name are required";
          }
          if (code.length > 5) {
            return "Code must be 5 characters or fewer";
          }
          return validateHexColor(draft.color, "#1D4ED8");
        },
        label: "Add Language",
      }}
      edit={{
        toDraft: (lang) => ({
          code: lang.code,
          name: lang.name,
          color: lang.color ?? "",
        }),
        onSave: (draft) =>
          updateMutation.mutateAsync({
            code: draft.code,
            name: draft.name.trim() || undefined,
            color: draft.color.trim() || null,
          }),
      }}
      reorder={{
        moves: flatReorder(languages, (lang) => lang.code),
        onReorder: (keys) => reorderMutation.mutateAsync(keys),
        isPending: reorderMutation.isPending,
      }}
      export={{
        filename: "languages.json",
        transform: (rows) =>
          rows.map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...rest }) => rest),
      }}
      delete={{
        onDelete: (lang) => deleteMutation.mutateAsync(lang.code),
      }}
    />
  );
}

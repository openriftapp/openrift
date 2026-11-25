import type { SetRelease } from "@openrift/shared/set-release";
import {
  formatReleasePeriod,
  isReleased,
  normalizeToPeriodStart,
} from "@openrift/shared/set-release";
import type { AdminSetResponse } from "@openrift/shared/types/api/admin";
import { WellKnown } from "@openrift/shared/well-known";
import { Link } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";

import { PageDescription } from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { SimpleSelect } from "@/components/ui/simple-select";
import { DraftTextInput, SlugCell } from "@/features/admin/components/admin-crud-shared";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { AdminTable } from "@/features/admin/components/admin-table";
import type {
  AdminCellSlotProps,
  AdminColumnDef,
  AdminDraftSlotProps,
} from "@/features/admin/components/admin-table";
import { CountBadge } from "@/features/admin/components/count-badge";
import { DatePrecisionControl } from "@/features/admin/components/date-precision-control";
import { FormatSetWindowsTable } from "@/features/admin/components/format-set-windows-table";
import { LanguageSelect } from "@/features/admin/components/language-select";
import { SetPicker } from "@/features/admin/components/set-picker";
import { useDeleteSetRelease, usePutSetRelease } from "@/features/admin/hooks/use-set-releases";
import { flatReorder } from "@/features/admin/lib/admin-reorder";
import { parseSetDraft, requireSetDraft } from "@/features/admin/lib/set-draft";
import {
  useCreateSet,
  useDeleteSet,
  useReorderSets,
  useSets,
  useUpdateSet,
} from "@/features/cards/hooks/use-sets";
import { useLanguageList } from "@/hooks/use-enums";
import { runReportedMutation } from "@/lib/run-reported-mutation";

interface SetDraft {
  id: string;
  name: string;
  printedTotal: string;
  setType: "main" | "supplemental";
}

function NameCell({ row }: AdminCellSlotProps<AdminSetResponse>) {
  if (!row) {
    return null;
  }
  return row.name;
}

function PrintedTotalCell({ row }: AdminCellSlotProps<AdminSetResponse>) {
  if (!row) {
    return null;
  }
  return row.printedTotal;
}

function ReleasesCell({ row }: AdminCellSlotProps<AdminSetResponse>) {
  if (!row) {
    return null;
  }
  const languages = Object.keys(row.releases).toSorted();
  if (languages.length === 0) {
    return <span className="text-muted-foreground">not announced</span>;
  }
  // Released state is derived from the date, so it is shown, never edited.
  return (
    <div className="flex flex-wrap gap-1">
      {languages.map((language) => (
        <Badge
          key={language}
          variant={isReleased(row.releases[language]) ? "default" : "secondary"}
        >
          {language} {formatReleasePeriod(row.releases[language])}
        </Badge>
      ))}
    </div>
  );
}

function SetTypeCell({ row }: AdminCellSlotProps<AdminSetResponse>) {
  if (!row) {
    return null;
  }
  return (
    <Badge variant={row.setType === WellKnown.setType.MAIN ? "default" : "secondary"}>
      {row.setType}
    </Badge>
  );
}

function CardsCell({ row }: AdminCellSlotProps<AdminSetResponse>) {
  if (!row) {
    return null;
  }
  if (row.cardCount === 0) {
    return <CountBadge count={0} />;
  }
  return (
    <Link to="/admin/cards" search={{ set: row.slug }} className="hover:opacity-70">
      <CountBadge count={row.cardCount} />
    </Link>
  );
}

function PrintingsCell({ row }: AdminCellSlotProps<AdminSetResponse>) {
  if (!row) {
    return null;
  }
  if (row.printingCount === 0) {
    return <CountBadge count={0} />;
  }
  return (
    <Link to="/admin/cards" search={{ set: row.slug }} className="hover:opacity-70">
      <CountBadge count={row.printingCount} />
    </Link>
  );
}

const SET_TYPE_ITEMS = [
  { value: "main", label: "main" },
  { value: "supplemental", label: "supplemental" },
] as const;

function SetTypeSelect({ draft, setDraft }: AdminDraftSlotProps<SetDraft>) {
  if (!draft || !setDraft) {
    return null;
  }
  return (
    <SimpleSelect
      items={SET_TYPE_ITEMS}
      value={draft.setType}
      onChange={(setType) => setDraft((prev) => ({ ...prev, setType }))}
      label="Set type"
      size="sm"
      className="w-32"
    />
  );
}

function DeleteSetDescription({ name }: { name: string }) {
  return (
    <>
      This will permanently delete the set <strong>{name}</strong>. Sets with printings cannot be
      deleted. Remove their printings first.
    </>
  );
}

const columns: AdminColumnDef<AdminSetResponse, SetDraft>[] = [
  {
    header: "ID",
    width: "w-24",
    cell: <SlugCell<AdminSetResponse> />,
    addCell: <DraftTextInput<SetDraft> field="id" placeholder="ID" className="font-mono" />,
  },
  {
    header: "Name",
    wrap: true,
    cell: <NameCell />,
    editCell: <DraftTextInput<SetDraft> field="name" placeholder="Name" />,
    addCell: <DraftTextInput<SetDraft> field="name" placeholder="Name" />,
  },
  {
    header: "Printed Total",
    width: "w-28",
    align: "right",
    cell: <PrintedTotalCell />,
    editCell: (
      <DraftTextInput<SetDraft>
        field="printedTotal"
        inputMode="numeric"
        placeholder="0"
        className="ml-auto text-right"
      />
    ),
    addCell: (
      <DraftTextInput<SetDraft>
        field="printedTotal"
        inputMode="numeric"
        placeholder="0"
        className="ml-auto text-right"
      />
    ),
  },
  {
    header: "Releases",
    width: "w-72",
    headerTitle: "Release period per language — edit them in the table below",
    cell: <ReleasesCell />,
  },
  {
    header: "Type",
    width: "w-32",
    cell: <SetTypeCell />,
    editCell: <SetTypeSelect />,
    addCell: <SetTypeSelect />,
  },
  {
    header: "Cards",
    width: "w-20",
    align: "right",
    headerTitle: "Cards in this set",
    cell: <CardsCell />,
  },
  {
    header: "Printings",
    width: "w-20",
    align: "right",
    headerTitle: "Printings in this set",
    cell: <PrintingsCell />,
  },
];

interface ReleaseRow {
  setId: string;
  setSlug: string;
  language: string;
  release: SetRelease;
}

interface ReleaseDraft {
  setId: string;
  language: string;
}

type WriteRelease = (setId: string, language: string, release: SetRelease) => void;

function toReleaseRows(sets: AdminSetResponse[]): ReleaseRow[] {
  return sets
    .flatMap((set) =>
      Object.keys(set.releases)
        .toSorted()
        .map((language) => ({
          setId: set.id,
          setSlug: set.slug,
          language,
          release: set.releases[language] as SetRelease,
        })),
    )
    .toSorted((a, b) => a.language.localeCompare(b.language));
}

function ReleaseSetCell({ row }: AdminCellSlotProps<ReleaseRow>) {
  if (!row) {
    return null;
  }
  return <span className="font-mono">{row.setSlug}</span>;
}

function ReleaseLanguageCell({ row }: AdminCellSlotProps<ReleaseRow>) {
  if (!row) {
    return null;
  }
  return <span className="text-muted-foreground font-mono">{row.language}</span>;
}

type RowBusy = (row: ReleaseRow) => boolean;

function releaseRowKey(setId: string, language: string) {
  return `${setId}-${language}`;
}

function ReleaseDateCell({
  row,
  write,
  resetKey,
  busy,
}: AdminCellSlotProps<ReleaseRow> & { write?: WriteRelease; resetKey?: number; busy?: RowBusy }) {
  if (!row || !write) {
    return null;
  }
  return (
    <DatePicker
      key={resetKey}
      aria-label="Release date"
      value={row.release.releasedAt}
      disabled={busy?.(row)}
      onValueChange={(iso) =>
        write(row.setId, row.language, {
          releasedAt: iso,
          precision: row.release.precision ?? "day",
        })
      }
      onClear={() => write(row.setId, row.language, { releasedAt: null, precision: null })}
      className="font-mono"
    />
  );
}

function ReleasePrecisionCell({
  row,
  write,
  busy,
}: AdminCellSlotProps<ReleaseRow> & { write?: WriteRelease; busy?: RowBusy }) {
  if (!row || !write) {
    return null;
  }
  return (
    <DatePrecisionControl
      includeQuarter
      value={row.release.precision ?? "day"}
      disabled={row.release.releasedAt === null || busy?.(row) === true}
      onChange={(precision) =>
        write(row.setId, row.language, { releasedAt: row.release.releasedAt, precision })
      }
    />
  );
}

function ReleaseShownCell({ row }: AdminCellSlotProps<ReleaseRow>) {
  if (!row) {
    return null;
  }
  return (
    <Badge variant={isReleased(row.release) ? "default" : "secondary"}>
      {formatReleasePeriod(row.release)}
    </Badge>
  );
}

function RemoveReleaseAction({
  row,
  remove,
  busy,
}: AdminCellSlotProps<ReleaseRow> & {
  remove?: (setId: string, language: string) => void;
  busy?: RowBusy;
}) {
  if (!row || !remove) {
    return null;
  }
  return (
    <Button
      variant="ghost-destructive"
      size="icon"
      aria-label={`Remove the ${row.language} release of ${row.setSlug}`}
      disabled={busy?.(row)}
      onClick={() => remove(row.setId, row.language)}
    >
      <Trash2Icon className="size-4" />
    </Button>
  );
}

function ReleaseSetInput({ draft, setDraft }: AdminDraftSlotProps<ReleaseDraft>) {
  if (!draft || !setDraft) {
    return null;
  }
  return (
    <SetPicker
      value={draft.setId}
      onChange={(setId) => setDraft((prev) => ({ ...prev, setId, language: "" }))}
      placeholder="Set"
      className="w-44"
    />
  );
}

function ReleaseLanguageInput({
  draft,
  setDraft,
  sets,
}: AdminDraftSlotProps<ReleaseDraft> & { sets?: AdminSetResponse[] }) {
  const languages = useLanguageList();
  if (!draft || !setDraft || !sets) {
    return null;
  }
  const taken = sets.find((set) => set.id === draft.setId)?.releases ?? {};
  return (
    <LanguageSelect
      label="Language"
      placeholder="Language"
      className="w-32"
      languages={languages.filter((language) => !(language.code in taken))}
      value={draft.language}
      onChange={(language) => setDraft((prev) => ({ ...prev, language }))}
    />
  );
}

function AddedUndatedNote({ draft }: AdminDraftSlotProps<ReleaseDraft>) {
  if (!draft) {
    return null;
  }
  return <span className="text-muted-foreground text-sm">Added as undated</span>;
}

/**
 * No released toggle: a set counts as released once its period passes. Clearing
 * the date leaves the language announced-undated; removing the row means not announced.
 */
function SetReleasesTable({ sets }: { sets: AdminSetResponse[] }) {
  const putRelease = usePutSetRelease();
  const deleteRelease = useDeleteSetRelease();
  const addRelease = usePutSetRelease({ inlineError: true });

  const [lastAddedSetId, setLastAddedSetId] = useState("");
  const [failedWrites, setFailedWrites] = useState(0);
  const [writing, setWriting] = useState<ReadonlySet<string>>(new Set());

  async function track(setId: string, language: string, run: () => Promise<unknown>) {
    const key = releaseRowKey(setId, language);
    setWriting((prev) => new Set(prev).add(key));
    const ok = await runReportedMutation(run);
    setWriting((prev) => new Set([...prev].filter((entry) => entry !== key)));
    if (!ok) {
      setFailedWrites((count) => count + 1);
    }
  }

  function writeRelease(setId: string, language: string, release: SetRelease) {
    void track(setId, language, () =>
      putRelease.mutateAsync({ id: setId, language, release: normalizeToPeriodStart(release) }),
    );
  }

  function removeRelease(setId: string, language: string) {
    void track(setId, language, () => deleteRelease.mutateAsync({ id: setId, language }));
  }

  const isWriting = (row: ReleaseRow) => writing.has(releaseRowKey(row.setId, row.language));

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Release dates per language</p>
        <p className="text-muted-foreground text-sm">
          A set counts as released in a language once its release period has passed, so there is no
          separate released switch. Use a coarser precision when only the month, quarter or year is
          known, and clear the date for a language that is announced without one.
        </p>
      </div>
      <AdminTable<ReleaseRow, ReleaseDraft>
        columns={[
          {
            header: "Set",
            width: "w-24",
            cell: <ReleaseSetCell />,
            addCell: <ReleaseSetInput />,
          },
          {
            header: "Language",
            width: "w-32",
            cell: <ReleaseLanguageCell />,
            addCell: <ReleaseLanguageInput sets={sets} />,
          },
          {
            header: "Date",
            width: "w-44",
            cell: <ReleaseDateCell write={writeRelease} resetKey={failedWrites} busy={isWriting} />,
          },
          {
            header: "Precision",
            cell: <ReleasePrecisionCell write={writeRelease} busy={isWriting} />,
            addCell: <AddedUndatedNote />,
          },
          { header: "Shown as", width: "w-32", cell: <ReleaseShownCell /> },
        ]}
        data={toReleaseRows(sets)}
        getRowKey={(row) => releaseRowKey(row.setId, row.language)}
        emptyText="No release dates yet."
        groupBy={{ key: (row) => row.language, label: (language) => language }}
        actions={<RemoveReleaseAction remove={removeRelease} busy={isWriting} />}
        add={{
          label: "Add release",
          emptyDraft: { setId: lastAddedSetId, language: "" },
          validate: (draft) =>
            draft.setId === "" || draft.language === "" ? "Pick a set and a language" : null,
          onSave: async (draft) => {
            await addRelease.mutateAsync({
              id: draft.setId,
              language: draft.language,
              release: { releasedAt: null, precision: null },
            });
            setLastAddedSetId(draft.setId);
          },
        }}
      />
    </div>
  );
}

export function SetsPage() {
  const { data } = useSets();
  const updateMutation = useUpdateSet({ inlineError: true });
  const createMutation = useCreateSet({ inlineError: true });
  const reorderMutation = useReorderSets();
  const deleteMutation = useDeleteSet();
  const { sets } = data;

  return (
    <div className="space-y-6">
      <AdminTable
        columns={columns}
        data={sets}
        getRowKey={(s) => s.id}
        emptyText="No sets yet."
        topBar={(actions) => <AdminPageTopBar title="Sets" actions={actions} />}
        toolbar={
          <PageDescription>
            Set order picks the default printing where none is pinned: first by language, then by
            set order.
          </PageDescription>
        }
        reorder={{
          rowLabel: (row) => row.name,
          moves: flatReorder(sets, (s) => s.id),
          onReorder: (keys) => reorderMutation.mutateAsync(keys),
          isPending: reorderMutation.isPending,
        }}
        export={{
          filename: "sets.json",
          transform: (rows) =>
            rows.map(
              ({ id: _id, cardCount: _cardCount, printingCount: _printingCount, ...rest }) => rest,
            ),
        }}
        add={{
          emptyDraft: {
            id: "",
            name: "",
            printedTotal: "",
            setType: WellKnown.setType.MAIN,
          },
          onSave: (d) =>
            createMutation.mutateAsync({
              id: d.id.trim(),
              ...requireSetDraft(d),
              setType: d.setType,
            }),
          validate: (d) => {
            if (!d.id.trim()) {
              return "ID is required";
            }
            const parsed = parseSetDraft(d);
            return "error" in parsed ? parsed.error : null;
          },
          label: "Add Set",
        }}
        edit={{
          toDraft: (s) => ({
            id: s.id,
            name: s.name,
            printedTotal: s.printedTotal === null ? "" : String(s.printedTotal),
            setType: s.setType,
          }),
          onSave: (d) =>
            updateMutation.mutateAsync({
              id: d.id,
              ...requireSetDraft(d),
              setType: d.setType,
            }),
          validate: (d) => {
            const parsed = parseSetDraft(d);
            return "error" in parsed ? parsed.error : null;
          },
        }}
        delete={{
          onDelete: (s) => deleteMutation.mutateAsync(s.id),
          confirm: (s) => ({
            title: `Delete set “${s.slug}”?`,
            description: <DeleteSetDescription name={s.name} />,
          }),
        }}
      />
      <SetReleasesTable sets={sets} />
      <FormatSetWindowsTable />
    </div>
  );
}

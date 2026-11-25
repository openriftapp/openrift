import type { AdminFormatSetResponse } from "@openrift/shared/contracts/admin/format-sets";
import { GLOBAL_CIRCUIT } from "@openrift/shared/types/api/preferences";
import { WellKnown } from "@openrift/shared/well-known";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { SimpleSelect } from "@/components/ui/simple-select";
import { AdminTable } from "@/features/admin/components/admin-table";
import type {
  AdminCellSlotProps,
  AdminDraftSlotProps,
} from "@/features/admin/components/admin-table";
import { SetPicker } from "@/features/admin/components/set-picker";
import {
  useFormatSets,
  useRemoveFormatSet,
  useUpsertFormatSet,
} from "@/features/admin/hooks/use-format-sets";
import { useCircuitList } from "@/hooks/use-enums";
import { runReportedMutation } from "@/lib/run-reported-mutation";

interface WindowDraft {
  setId: string;
  circuit: string;
}

type WriteWindow = (
  row: AdminFormatSetResponse,
  dates: Pick<AdminFormatSetResponse, "legalFrom" | "legalUntil">,
) => void;

function windowKey(row: Pick<AdminFormatSetResponse, "formatId" | "setId" | "circuit">) {
  return `${row.formatId}-${row.setId}-${row.circuit ?? GLOBAL_CIRCUIT}`;
}

function SetCell({ row }: AdminCellSlotProps<AdminFormatSetResponse>) {
  return row ? <span className="font-mono">{row.setSlug}</span> : null;
}

type RowBusy = (row: AdminFormatSetResponse) => boolean;

function LegalFromCell({
  row,
  write,
  busy,
}: AdminCellSlotProps<AdminFormatSetResponse> & { write?: WriteWindow; busy?: RowBusy }) {
  if (!row || !write) {
    return null;
  }
  return (
    <DatePicker
      aria-label="Legal from"
      value={row.legalFrom}
      disabled={busy?.(row)}
      onValueChange={(legalFrom) => write(row, { legalFrom, legalUntil: row.legalUntil })}
      onClear={
        row.legalUntil === null
          ? () => write(row, { legalFrom: null, legalUntil: null })
          : undefined
      }
      className="font-mono"
    />
  );
}

function LegalUntilCell({
  row,
  write,
  busy,
}: AdminCellSlotProps<AdminFormatSetResponse> & { write?: WriteWindow; busy?: RowBusy }) {
  if (!row || !write) {
    return null;
  }
  return (
    <DatePicker
      aria-label="Legal until"
      value={row.legalUntil}
      disabled={row.legalFrom === null || busy?.(row) === true}
      onValueChange={(legalUntil) => write(row, { legalFrom: row.legalFrom, legalUntil })}
      onClear={() => write(row, { legalFrom: row.legalFrom, legalUntil: null })}
      className="font-mono"
    />
  );
}

function RemoveWindowAction({
  row,
  remove,
  busy,
}: AdminCellSlotProps<AdminFormatSetResponse> & {
  remove?: (row: AdminFormatSetResponse) => void;
  busy?: RowBusy;
}) {
  if (!row || !remove) {
    return null;
  }
  return (
    <Button
      variant="ghost-destructive"
      size="icon"
      aria-label={`Remove ${row.setSlug} from the format`}
      disabled={busy?.(row)}
      onClick={() => remove(row)}
    >
      <Trash2Icon className="size-4" />
    </Button>
  );
}

function SetInput({ draft, setDraft }: AdminDraftSlotProps<WindowDraft>) {
  if (!draft || !setDraft) {
    return null;
  }
  return (
    <SetPicker
      value={draft.setId}
      onChange={(setId) => setDraft((prev) => ({ ...prev, setId }))}
      placeholder="Set"
      className="w-44"
    />
  );
}

function CircuitInput({ draft, setDraft }: AdminDraftSlotProps<WindowDraft>) {
  const circuits = useCircuitList();
  if (!draft || !setDraft) {
    return null;
  }
  return (
    <SimpleSelect
      items={[
        { value: GLOBAL_CIRCUIT, label: "Global" },
        ...circuits.map((circuit) => ({ value: circuit.slug, label: circuit.label })),
      ]}
      value={draft.circuit}
      onChange={(circuit) => setDraft((prev) => ({ ...prev, circuit }))}
      label="Region"
      className="w-52"
    />
  );
}

/** Standard's legal sets. A region row replaces the global row of its set there. */
export function FormatSetWindowsTable() {
  const { data: windows } = useFormatSets();
  const circuits = useCircuitList();
  const upsert = useUpsertFormatSet();
  const add = useUpsertFormatSet({ inlineError: true });
  const remove = useRemoveFormatSet();
  const [failedWrites, setFailedWrites] = useState(0);
  const [writing, setWriting] = useState<ReadonlySet<string>>(new Set());

  const circuitLabel = (slug: string) =>
    slug === GLOBAL_CIRCUIT
      ? "Global"
      : (circuits.find((circuit) => circuit.slug === slug)?.label ?? slug);

  async function track(row: AdminFormatSetResponse, run: () => Promise<unknown>) {
    const key = windowKey(row);
    setWriting((prev) => new Set(prev).add(key));
    const ok = await runReportedMutation(run);
    setWriting((prev) => new Set([...prev].filter((entry) => entry !== key)));
    if (!ok) {
      setFailedWrites((count) => count + 1);
    }
  }

  const isWriting: RowBusy = (row) => writing.has(windowKey(row));

  const write: WriteWindow = (row, dates) => {
    void track(row, () =>
      upsert.mutateAsync({
        formatId: row.formatId,
        setId: row.setId,
        circuit: row.circuit,
        ...dates,
      }),
    );
  };

  const removeWindow = (row: AdminFormatSetResponse) => {
    void track(row, () =>
      remove.mutateAsync({ formatId: row.formatId, setId: row.setId, circuit: row.circuit }),
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Standard legality</p>
        <p className="text-muted-foreground text-sm">
          A card is legal in Standard while one of its sets is, counting only printings within the
          set&apos;s normal numbering. A set with no row is not legal. An empty start date means
          announced without a date. A region row replaces the global row of its set in that region.
        </p>
      </div>
      <AdminTable<AdminFormatSetResponse, WindowDraft>
        key={failedWrites}
        columns={[
          { header: "Set", width: "w-24", cell: <SetCell />, addCell: <SetInput /> },
          {
            header: "Legal from",
            width: "w-44",
            cell: <LegalFromCell write={write} busy={isWriting} />,
            addCell: <CircuitInput />,
          },
          {
            header: "Legal until",
            width: "w-44",
            cell: <LegalUntilCell write={write} busy={isWriting} />,
          },
        ]}
        data={windows.filter((row) => row.formatId === WellKnown.banFormat.CONSTRUCTED)}
        getRowKey={windowKey}
        emptyText="No sets are legal in Standard yet."
        groupBy={{
          key: (row) => row.circuit ?? GLOBAL_CIRCUIT,
          label: (key) => circuitLabel(key),
        }}
        actions={<RemoveWindowAction remove={removeWindow} busy={isWriting} />}
        add={{
          label: "Add set",
          emptyDraft: { setId: "", circuit: GLOBAL_CIRCUIT },
          validate: (draft) => {
            if (draft.setId === "") {
              return "Pick a set";
            }
            const circuit = draft.circuit === GLOBAL_CIRCUIT ? null : draft.circuit;
            const taken = windows.some(
              (row) =>
                row.formatId === WellKnown.banFormat.CONSTRUCTED &&
                row.setId === draft.setId &&
                row.circuit === circuit,
            );
            return taken ? "This set already has a row for that region" : null;
          },
          onSave: async (draft) => {
            await add.mutateAsync({
              formatId: WellKnown.banFormat.CONSTRUCTED,
              setId: draft.setId,
              circuit: draft.circuit === GLOBAL_CIRCUIT ? null : draft.circuit,
              legalFrom: null,
              legalUntil: null,
            });
          },
        }}
      />
    </div>
  );
}

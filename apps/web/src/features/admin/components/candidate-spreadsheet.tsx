import type { ProviderSettingResponse } from "@openrift/shared/types/api/admin";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { Fragment, useState } from "react";

import { CandidateActiveCell } from "@/features/admin/components/candidate-active-cell";
import type { FieldDef } from "@/features/admin/components/candidate-field-defs";
import { CandidateSpreadsheetHeader } from "@/features/admin/components/candidate-spreadsheet-header";
import { CandidateValueCell } from "@/features/admin/components/candidate-value-cell";
import { foldedFieldKeys } from "@/features/admin/components/card-detail-shared";
import type { CandidateSpreadsheetRow } from "@/features/admin/lib/candidate-rows";
import { favoriteProviderSet, sortCandidateRows } from "@/features/admin/lib/candidate-rows";
import type { SourceSubmitter } from "@/features/admin/lib/candidate-submitter";

const CANDIDATE_COLUMN_WIDTH = 256;
const FIXED_COLUMNS_WIDTH = 160 + 256;

interface CandidateSpreadsheetProps<
  TKey extends string = string,
  TRow extends CandidateSpreadsheetRow = CandidateSpreadsheetRow,
> {
  fields: FieldDef<TKey>[];
  activeRow: Record<string, unknown> | null;
  candidateRows: TRow[];
  providerLabels?: Record<string, string>;
  providerNames?: Record<string, string>;
  submitters?: Record<string, SourceSubmitter>;
  providerSettings?: ProviderSettingResponse[];
  requiredKeys?: string[];
  onCellClick?: (field: TKey, value: unknown, candidateId: string) => void;
  onActiveChange?: (field: TKey, value: unknown | null) => void;
  onCheck?: (candidateId: string) => void;
  onUncheck?: (candidateId: string) => void;
  columnActions?: React.ReactElement<{ row?: NoInfer<TRow> }>;
  columnClassName?: (row: NoInfer<TRow>) => string | undefined;
  cellWarning?: (fieldKey: string, candidateValue: unknown) => string | null;
  renderCandidateCell?: (field: FieldDef<TKey>, row: NoInfer<TRow>) => React.ReactNode | undefined;
  renderActiveCell?: (field: FieldDef<TKey>) => React.ReactNode | undefined;
  normalizeCandidate?: (fieldKey: string, value: unknown) => unknown;
  activeImageUrl?: string | null;
  costKeywords?: readonly string[];
  activeColumnBadge?: React.ReactNode;
  agreedFieldsFolded?: boolean;
  onAgreedFieldsFoldedChange?: (folded: boolean) => void;
}

export function CandidateSpreadsheet<
  TKey extends string = string,
  TRow extends CandidateSpreadsheetRow = CandidateSpreadsheetRow,
>({
  fields,
  activeRow,
  candidateRows,
  providerLabels,
  providerNames,
  submitters,
  providerSettings,
  requiredKeys,
  onCellClick,
  onActiveChange,
  onCheck,
  onUncheck,
  columnActions,
  columnClassName,
  cellWarning,
  renderCandidateCell,
  renderActiveCell,
  normalizeCandidate,
  activeImageUrl,
  costKeywords = [],
  activeColumnBadge,
  agreedFieldsFolded,
  onAgreedFieldsFoldedChange,
}: CandidateSpreadsheetProps<TKey, TRow>) {
  const favoriteProviders = favoriteProviderSet(providerSettings);
  const sortedRows = sortCandidateRows(candidateRows, providerLabels, providerSettings);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [localCollapsed, setLocalCollapsed] = useState(true);
  const collapsed = agreedFieldsFolded ?? localCollapsed;

  function toggleCollapsed() {
    if (onAgreedFieldsFoldedChange) {
      onAgreedFieldsFoldedChange(!collapsed);
      return;
    }
    setLocalCollapsed((c) => !c);
  }

  const foldedKeys = foldedFieldKeys(
    fields,
    sortedRows,
    activeRow,
    normalizeCandidate,
    requiredKeys,
  );
  const firstFoldedKey = fields.find((field) => foldedKeys.has(field.key))?.key;

  function foldToggleRow(key: string) {
    return (
      // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- label lives in the <td> inside; rule doesn't see across children
      <tr
        key={`${key}+toggle`}
        className="bg-muted/30 hover:bg-muted/50 cursor-pointer border-b"
        onClick={toggleCollapsed}
      >
        <td
          className="bg-muted/30 text-muted-foreground sticky left-0 z-10 px-3 py-1 font-medium"
          colSpan={2 + sortedRows.length}
        >
          <span className="inline-flex items-center gap-1">
            {collapsed ? (
              <ChevronRightIcon className="size-3" />
            ) : (
              <ChevronDownIcon className="size-3" />
            )}
            {collapsed
              ? `${foldedKeys.size} field${foldedKeys.size > 1 ? "s" : ""} everyone agrees on`
              : "Hide"}
          </span>
        </td>
      </tr>
    );
  }

  return (
    <div className="w-fit max-w-full overflow-x-auto rounded-md border">
      <table
        className="table-fixed text-sm"
        style={{ width: FIXED_COLUMNS_WIDTH + CANDIDATE_COLUMN_WIDTH * sortedRows.length }}
      >
        <CandidateSpreadsheetHeader
          sortedRows={sortedRows}
          providerLabels={providerLabels}
          providerNames={providerNames}
          submitters={submitters}
          favoriteProviders={favoriteProviders}
          onCheck={onCheck}
          onUncheck={onUncheck}
          columnActions={columnActions}
          columnClassName={columnClassName}
          activeColumnBadge={activeColumnBadge}
        />
        <tbody>
          {fields.map((field) => {
            const isFolded = foldedKeys.has(field.key);
            const showToggle = field.key === firstFoldedKey;
            if (isFolded && collapsed) {
              return showToggle ? foldToggleRow(field.key) : null;
            }

            const activeValue = activeRow ? (activeRow[field.key] as unknown) : null;
            const isRequired = requiredKeys?.includes(field.key) ?? false;

            const fieldRow = (
              <tr key={field.key} className="border-b last:border-b-0">
                <td className="bg-background sticky left-0 z-10 px-3 py-1.5 font-medium">
                  {field.label}
                  {isRequired && <span className="text-destructive ml-0.5">*</span>}
                </td>
                <CandidateActiveCell
                  field={field}
                  activeRow={activeRow}
                  activeValue={activeValue}
                  isRequired={isRequired}
                  editingField={editingField}
                  setEditingField={setEditingField}
                  onActiveChange={onActiveChange}
                  activeImageUrl={activeImageUrl}
                  costKeywords={costKeywords}
                  renderContent={renderActiveCell}
                />
                {sortedRows.map((row) => (
                  <CandidateValueCell
                    key={row.id}
                    field={field}
                    row={row}
                    activeRow={activeRow}
                    activeValue={activeValue}
                    providerLabels={providerLabels}
                    favoriteProviders={favoriteProviders}
                    normalizeCandidate={normalizeCandidate}
                    cellWarning={cellWarning}
                    renderContent={
                      renderCandidateCell as
                        | ((
                            field: FieldDef<TKey>,
                            row: CandidateSpreadsheetRow,
                          ) => React.ReactNode | undefined)
                        | undefined
                    }
                    onCellClick={onCellClick}
                  />
                ))}
              </tr>
            );

            if (!showToggle) {
              return fieldRow;
            }
            return (
              <Fragment key={`${field.key}+toggle`}>
                {foldToggleRow(field.key)}
                {fieldRow}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

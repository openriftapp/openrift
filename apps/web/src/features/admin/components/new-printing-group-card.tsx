import { appendSetTotal } from "@openrift/shared/fix-typography";
import { REQUIRED_ACCEPT_PRINTING_FIELDS } from "@openrift/shared/printing-accept";
import { setSlugFromShortCode, shortCodeFromPublicCode } from "@openrift/shared/printing-code";
import { formatPrintingLabel } from "@openrift/shared/printing-label";
import { pluralize, stringifyUnknown } from "@openrift/shared/strings";
import type {
  AdminPrintingResponse,
  CandidateCardResponse,
  CandidatePrintingResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";
import { ArrowRightIcon, CheckCheckIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import type {
  CandidatePrintingFieldKey,
  FieldDef,
} from "@/features/admin/components/candidate-field-defs";
import { CandidateSpreadsheet } from "@/features/admin/components/candidate-spreadsheet";
import {
  buildPreseededActivePrinting,
  hasRequiredPrintingFields,
  buildPrintingNormalizer,
  unknownOptionValues,
  useCardDetailData,
} from "@/features/admin/components/card-detail-shared";
import { PrintingIdLabel } from "@/features/admin/components/printing-id-label";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { PrintingSourceActions } from "@/features/admin/components/printing-source-actions";
import type { PrintingGroup } from "@/features/admin/lib/candidate-printing-groups";
import type { SourceSubmitter } from "@/features/admin/lib/candidate-submitter";

/** The grids ask for the public code only; the short code and the set follow it. */
function withDerivedCodes(record: Record<string, unknown>): Record<string, unknown> {
  const shortCode = shortCodeFromPublicCode(record.publicCode) ?? record.shortCode;
  const setId = setSlugFromShortCode(shortCode);
  return {
    ...record,
    ...(shortCode === undefined ? {} : { shortCode }),
    ...(setId === null ? {} : { setId }),
  };
}

interface NewPrintingColumnActionsProps {
  row?: CandidateCardResponse | CandidatePrintingResponse;
  existingPrintings: AdminPrintingResponse[];
  printingFields: FieldDef<CandidatePrintingFieldKey>[];
  onLink: (printingId: string, candidatePrintingIds: string[]) => void;
  onCopy: (id: string, printingId: string) => void;
  onAcceptAllForRow: (rowId: string, values: Record<string, unknown>) => void;
  onIgnore: (externalId: string, finish: string | null) => void;
  onDelete: (id: string) => void;
  isAdmin: boolean;
}

function NewPrintingColumnActions({
  row,
  existingPrintings,
  printingFields,
  onLink,
  onCopy,
  onAcceptAllForRow,
  onIgnore,
  onDelete,
  isAdmin,
}: NewPrintingColumnActionsProps) {
  if (!row) {
    return null;
  }
  return (
    <PrintingSourceActions
      targets={existingPrintings.map((p) => ({
        id: p.id,
        label: p.expectedPrintingId,
      }))}
      onAssign={isAdmin ? (pid) => onLink(pid, [row.id]) : undefined}
      onCopy={isAdmin ? (pid) => onCopy(row.id, pid) : undefined}
      onAcceptAll={() => {
        const record = row as unknown as Record<string, unknown>;
        const values: Record<string, unknown> = {};
        for (const field of printingFields) {
          if (field.readOnly) {
            continue;
          }
          const val = record[field.key];
          if (val === null || val === undefined || val === "") {
            continue;
          }
          if (field.options && !field.options.includes(stringifyUnknown(val))) {
            continue;
          }
          values[field.key] = val;
        }
        onAcceptAllForRow(row.id, values);
      }}
      onIgnore={
        isAdmin ? () => onIgnore(row.externalId, "finish" in row ? row.finish : null) : undefined
      }
      onDelete={isAdmin ? () => onDelete(row.id) : undefined}
    />
  );
}

export function NewPrintingGroupCard({
  group,
  existingPrintings,
  providerLabels,
  providerNames,
  providerSubmitters,
  providerSettings,
  setTotals,
  setReleaseYears,
  isExpanded,
  onToggle,
  onAccept,
  onLink,
  onCopy,
  onDelete,
  onIgnore,
  isAccepting,
  isLinking,
  printingFields,
  costKeywords = [],
  invalidates,
  isAdmin,
  landscape = false,
}: {
  group: PrintingGroup & { groupKey: string };
  existingPrintings: AdminPrintingResponse[];
  providerLabels: Record<string, string>;
  providerNames: Record<string, string>;
  providerSubmitters: Record<string, SourceSubmitter>;
  providerSettings: ProviderSettingResponse[];
  setTotals: Record<string, number>;
  setReleaseYears: Record<string, number>;
  isExpanded: boolean;
  onToggle: () => void;
  onAccept: (printingFields: Record<string, unknown>, candidatePrintingIds: string[]) => void;
  onLink: (printingId: string, candidatePrintingIds: string[]) => void;
  onCopy: (id: string, printingId: string) => void;
  onDelete: (id: string) => void;
  onIgnore: (externalId: string, finish: string | null) => void;
  isAccepting: boolean;
  isLinking?: boolean;
  printingFields: FieldDef<CandidatePrintingFieldKey>[];
  costKeywords?: readonly string[];
  invalidates: readonly (readonly unknown[])[];
  isAdmin: boolean;
  landscape?: boolean;
}) {
  const { checkPrintingSource, uncheckPrintingSource, checkAllCandidatePrintings } =
    useCardDetailData(invalidates);
  // Once the admin edits the Active column the pre-seed stops applying and
  // the "Pre-filled" marker clears.
  const [edited, setEdited] = useState<Record<string, unknown> | null>(null);

  function withSetTotal(record: Record<string, unknown>): Record<string, unknown> {
    const code = record.publicCode;
    const setSlug = record.setId;
    if (typeof code !== "string" || typeof setSlug !== "string") {
      return record;
    }
    const withTotal = appendSetTotal(code, setTotals[setSlug]);
    return withTotal === code ? record : { ...record, publicCode: withTotal };
  }

  // Mirrors the accept endpoint's transforms: typography fixes on
  // rules/effect/flavor, set-total on publicCode.
  const normalizePrinting = buildPrintingNormalizer(
    setTotals,
    group.candidates[0]?.setId,
    costKeywords,
  );
  function normalizeRecord(record: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(record).map(([key, value]) => [key, normalizePrinting(key, value)]),
    );
  }

  // Derived every render while untouched, so the pre-seed follows the enum and
  // provider lists as they finish loading.
  const seed = normalizeRecord(
    buildPreseededActivePrinting(
      group.candidates,
      printingFields,
      providerSettings,
      providerLabels,
      setReleaseYears,
    ),
  );
  const activePrinting = edited ?? seed;
  const touched = edited !== null;
  const editPrinting = (update: (prev: Record<string, unknown>) => Record<string, unknown>) => {
    setEdited((prev) => update(prev ?? seed));
  };

  const unknownValues = unknownOptionValues(group.candidates, printingFields, providerLabels);

  const markerSlugs = Array.isArray(activePrinting.markerSlugs)
    ? (activePrinting.markerSlugs as string[])
    : [];
  const derivedPrinting = withDerivedCodes(activePrinting);
  const hasRequired = hasRequiredPrintingFields(derivedPrinting);
  const derivedShortCode = derivedPrinting.shortCode;
  const printingLabel =
    hasRequired && typeof derivedShortCode === "string"
      ? formatPrintingLabel(
          derivedShortCode,
          markerSlugs,
          activePrinting.finish as string,
          (activePrinting.language as string | undefined) ?? null,
        )
      : "";

  const guessedId = group.expectedPrintingId;

  const isPreseeded = !touched && Object.keys(activePrinting).length > 0;

  const matchingExisting = existingPrintings.find((p) => p.expectedPrintingId === guessedId);
  // Falls back to the server-side near-miss suggestion (same code + language,
  // marker/finish may drift) when there's no exact match.
  const suggestedExisting = matchingExisting
    ? undefined
    : existingPrintings.find((p) => p.id === group.suggestedPrintingId);

  return (
    <div data-printing-group={group.groupKey}>
      <div className="hover:bg-muted/50 flex flex-wrap items-center gap-3 px-3 py-2">
        <ExpandToggle expanded={isExpanded} className="text-sm font-medium" onClick={onToggle}>
          <span className="inline-flex items-center gap-1">
            New:
            <PrintingIdLabel
              label={printingLabel || guessedId}
              language={(activePrinting.language as string | undefined) ?? null}
              className="text-muted-foreground"
            />
            ({group.candidates.length} {pluralize(group.candidates.length, "source")})
          </span>
        </ExpandToggle>
        <div className="flex flex-wrap items-end gap-2">
          {isAdmin && group.candidates.some((s) => !s.checkedAt) && (
            <Button
              variant="outline"
              size="sm"
              pending={checkAllCandidatePrintings.isPending}
              onClick={(e) => {
                e.stopPropagation();
                checkAllCandidatePrintings.mutate({
                  extraIds: group.candidates.filter((s) => !s.checkedAt).map((s) => s.id),
                });
              }}
            >
              <CheckCheckIcon className="size-3" />
              Check {group.candidates.filter((s) => !s.checkedAt).length} unchecked
            </Button>
          )}
          {isAdmin && matchingExisting && (
            <Button
              variant="default"
              size="sm"
              disabled={isLinking}
              onClick={() =>
                onLink(
                  matchingExisting.id,
                  group.candidates.map((s) => s.id),
                )
              }
            >
              <ArrowRightIcon className="size-3.5" />
              Assign all to existing
            </Button>
          )}
          {isAdmin && suggestedExisting && (
            <Button
              variant="outline"
              size="sm"
              disabled={isLinking}
              onClick={() =>
                onLink(
                  suggestedExisting.id,
                  group.candidates.map((s) => s.id),
                )
              }
            >
              <ArrowRightIcon className="size-3.5" />
              Assign all to {suggestedExisting.expectedPrintingId}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!hasRequired || isAccepting}
            onClick={() =>
              onAccept(
                derivedPrinting,
                group.candidates.map((s) => s.id),
              )
            }
          >
            <PlusIcon className="size-3.5" />
            Accept as new printing
          </Button>
        </div>
      </div>
      {isExpanded && (
        <>
          {!hasRequired && (
            <p className="text-muted-foreground px-3 pb-2">
              Click cells to fill all required fields (marked with *).
            </p>
          )}
          {unknownValues.length > 0 && (
            <p className="text-muted-foreground flex items-start gap-1.5 px-3 pb-2">
              <TriangleAlertIcon className="text-warning mt-0.5 size-4 shrink-0" />
              <span>
                Left out because the value is not on the admin list:{" "}
                {unknownValues
                  .map((entry) => `${entry.provider} ${entry.label} “${entry.value}”`)
                  .join(", ")}
                . Add it there, or pick a value.
              </span>
            </p>
          )}
          <div className="flex flex-col gap-3 px-3 pb-3">
            <div className="min-w-0 flex-1">
              <CandidateSpreadsheet
                fields={printingFields}
                requiredKeys={REQUIRED_ACCEPT_PRINTING_FIELDS}
                activeRow={Object.keys(activePrinting).length > 0 ? activePrinting : null}
                candidateRows={group.candidates}
                providerLabels={providerLabels}
                providerNames={providerNames}
                submitters={providerSubmitters}
                providerSettings={providerSettings}
                costKeywords={costKeywords}
                activeColumnBadge={
                  isPreseeded ? (
                    <Badge variant="warning" className="font-normal">
                      Pre-filled
                    </Badge>
                  ) : null
                }
                renderActiveCell={(field) =>
                  field.key === "imageUrl" ? (
                    <PrintingImageBox
                      url={
                        typeof activePrinting.imageUrl === "string" ? activePrinting.imageUrl : null
                      }
                      alt="Image this printing is accepted with"
                      href={
                        typeof activePrinting.imageUrl === "string"
                          ? activePrinting.imageUrl
                          : undefined
                      }
                      landscape={landscape}
                    />
                  ) : null
                }
                renderCandidateCell={(field, row) => {
                  if (field.key !== "imageUrl" || typeof row.imageUrl !== "string") {
                    return null;
                  }
                  const url = row.imageUrl;
                  const chosen = activePrinting.imageUrl === url;
                  return (
                    <span className="block space-y-1">
                      <PrintingImageBox
                        url={url}
                        alt="Source image"
                        href={url}
                        landscape={landscape}
                      />
                      {chosen ? (
                        <span className="text-muted-foreground block text-xs">Accepting this</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => {
                            editPrinting((prev) => ({ ...prev, imageUrl: url }));
                          }}
                        >
                          Use this
                        </Button>
                      )}
                    </span>
                  );
                }}
                normalizeCandidate={normalizePrinting}
                onCellClick={(field, value) => {
                  editPrinting((prev) => withSetTotal({ ...prev, [field]: value }));
                }}
                onActiveChange={(field, value) => {
                  editPrinting((prev) =>
                    value === null || value === undefined
                      ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== field))
                      : withSetTotal({ ...prev, [field]: value }),
                  );
                }}
                onCheck={isAdmin ? (id) => checkPrintingSource.mutate(id) : undefined}
                onUncheck={isAdmin ? (id) => uncheckPrintingSource.mutate(id) : undefined}
                columnActions={
                  <NewPrintingColumnActions
                    existingPrintings={existingPrintings}
                    printingFields={printingFields}
                    onLink={onLink}
                    onCopy={onCopy}
                    onAcceptAllForRow={(_rowId, values) => {
                      editPrinting((prev) => withSetTotal({ ...prev, ...normalizeRecord(values) }));
                    }}
                    onIgnore={onIgnore}
                    onDelete={onDelete}
                    isAdmin={isAdmin}
                  />
                }
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

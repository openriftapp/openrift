import type { AcceptCardField } from "@openrift/shared/contracts/admin/card-mutations";
import { isAcceptCardField } from "@openrift/shared/contracts/admin/card-mutations";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import type {
  AdminCardResponse,
  CandidateCardResponse,
  CandidatePrintingResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";
import { BanIcon, CheckCheckIcon, CopyCheckIcon, MessageSquareIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type {
  CandidateCardFieldKey,
  FieldDef,
} from "@/features/admin/components/candidate-field-defs";
import { CandidateSpreadsheet } from "@/features/admin/components/candidate-spreadsheet";
import { SubmissionResolutionDialog } from "@/features/admin/components/submission-resolution-dialog";
import {
  useAcceptCardField,
  useCheckCandidateCard,
  useUncheckCandidateCard,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useIgnoreCandidateCard } from "@/features/admin/hooks/use-ignored-candidates";
import { toastFieldAccepted } from "@/features/admin/lib/accept-undo";
import { getProviderLabel } from "@/features/admin/lib/candidate-rows";
import { buildSourceSubmitters } from "@/features/admin/lib/candidate-submitter";

interface CardSourceColumnActionsProps {
  row?: CandidateCardResponse | CandidatePrintingResponse;
  cardId: string;
  candidateCardFields: FieldDef<CandidateCardFieldKey>[];
  onAcceptField: (input: {
    cardId: string;
    field: AcceptCardField;
    value: unknown;
    source?: "manual" | "provider";
  }) => void;
  onIgnoreSource: (input: { provider: string; externalId: string }) => void;
  onResolveSubmission: (candidateCardId: string, mode: "reject" | "reply") => void;
  isAdmin: boolean;
}

function CardSourceColumnActions({
  row,
  cardId,
  candidateCardFields,
  onAcceptField,
  onIgnoreSource,
  onResolveSubmission,
  isAdmin,
}: CardSourceColumnActionsProps) {
  if (!row) {
    return null;
  }
  const cardRow = row as CandidateCardResponse;
  // A submission's external_id is minted per submission and never re-uploaded.
  const isUserSubmission = cardRow.provider === USER_SUBMISSION_PROVIDER;
  return (
    <>
      <DropdownMenuItem
        onClick={() => {
          const record = row as unknown as Record<string, unknown>;
          for (const field of candidateCardFields) {
            // The grid also carries read-only provider columns the accept endpoint does not take.
            if (!isAcceptCardField(field.key)) {
              continue;
            }
            const val = record[field.key];
            if (val !== null && val !== undefined && val !== "") {
              onAcceptField({ cardId, field: field.key, value: val, source: "provider" });
            }
          }
        }}
      >
        <CopyCheckIcon className="mr-2" />
        Accept all fields
      </DropdownMenuItem>
      {isAdmin && isUserSubmission && (
        <DropdownMenuItem onClick={() => onResolveSubmission(cardRow.id, "reply")}>
          <MessageSquareIcon className="mr-2" />
          Reply to contributor
        </DropdownMenuItem>
      )}
      {isAdmin && (
        <DropdownMenuItem
          onClick={() => {
            if (isUserSubmission) {
              onResolveSubmission(cardRow.id, "reject");
              return;
            }
            onIgnoreSource({ provider: cardRow.provider, externalId: row.externalId });
          }}
        >
          <BanIcon className="mr-2" />
          {isUserSubmission ? "Reject submission" : "Ignore permanently"}
        </DropdownMenuItem>
      )}
    </>
  );
}

interface CardFieldsSectionProps {
  card: AdminCardResponse;
  sources: CandidateCardResponse[];
  candidateCardFields: FieldDef<CandidateCardFieldKey>[];
  providerSettings: ProviderSettingResponse[];
  onCheckAllSources: () => void;
  isCheckingAllSources: boolean;
  invalidates: readonly (readonly unknown[])[];
  isAdmin: boolean;
}

export function CardFieldsSection({
  card,
  sources,
  candidateCardFields,
  providerSettings,
  onCheckAllSources,
  isCheckingAllSources,
  invalidates,
  isAdmin,
}: CardFieldsSectionProps) {
  const acceptCardField = useAcceptCardField(invalidates);
  const checkCandidateCard = useCheckCandidateCard(invalidates);
  const uncheckCandidateCard = useUncheckCandidateCard(invalidates);
  const ignoreCardSource = useIgnoreCandidateCard();
  // The column menu is cloned per source column; dialog state must live here, not in the menu.
  const [resolution, setResolution] = useState<{
    candidateCardId: string;
    mode: "reject" | "reply";
  } | null>(null);

  const uncheckedCount = sources.filter((s) => !s.checkedAt).length;
  const submitters = buildSourceSubmitters(sources);
  const resolutionSource = sources.find((s) => s.id === resolution?.candidateCardId);

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        {isAdmin && uncheckedCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={isCheckingAllSources}
            onClick={onCheckAllSources}
          >
            <CheckCheckIcon className="mr-1" />
            Check {uncheckedCount} unchecked
          </Button>
        )}
      </div>
      <CandidateSpreadsheet
        fields={candidateCardFields}
        requiredKeys={["name", "types", "domains"]}
        activeRow={{ ...card }}
        candidateRows={sources}
        submitters={submitters}
        providerSettings={providerSettings}
        onCellClick={(field, value, candidateId) => {
          if (!isAcceptCardField(field)) {
            return;
          }
          const previousValue = (card as Record<string, unknown>)[field];
          acceptCardField.mutate({ cardId: card.id, field, value, source: "provider" });
          const row = sources.find((source) => source.id === candidateId);
          toastFieldAccepted({
            fieldLabel: candidateCardFields.find((entry) => entry.key === field)?.label ?? field,
            sourceLabel: row === undefined ? "this source" : getProviderLabel(row),
            previousValue,
            onUndo: (previous) =>
              acceptCardField.mutate({
                cardId: card.id,
                field,
                value: previous,
                source: "manual",
              }),
          });
        }}
        onActiveChange={(field, value) => {
          if (value === undefined || !isAcceptCardField(field)) {
            return;
          }
          acceptCardField.mutate({ cardId: card.id, field, value });
        }}
        onCheck={isAdmin ? (candidateId) => checkCandidateCard.mutate(candidateId) : undefined}
        onUncheck={isAdmin ? (candidateId) => uncheckCandidateCard.mutate(candidateId) : undefined}
        columnActions={
          <CardSourceColumnActions
            cardId={card.id}
            candidateCardFields={candidateCardFields}
            onAcceptField={(input) => acceptCardField.mutate(input)}
            onIgnoreSource={(input) => ignoreCardSource.mutate(input)}
            onResolveSubmission={(candidateCardId, mode) =>
              setResolution({ candidateCardId, mode })
            }
            isAdmin={isAdmin}
          />
        }
      />
      <SubmissionResolutionDialog
        candidateCardId={resolution?.candidateCardId ?? null}
        mode={resolution?.mode ?? "reply"}
        onOpenChange={(open) => {
          if (!open) {
            setResolution(null);
          }
        }}
        onConfirmed={() => {
          // The rejection itself is the ignore; the dialog only owns the
          // message that goes with it.
          if (resolution?.mode === "reject" && resolutionSource) {
            ignoreCardSource.mutate({
              provider: resolutionSource.provider,
              externalId: resolutionSource.externalId,
            });
          }
        }}
      />
    </section>
  );
}

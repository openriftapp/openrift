import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import type {
  AdminCardResponse,
  CandidateCardResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type {
  CandidateCardFieldKey,
  FieldDef,
} from "@/features/admin/components/candidate-field-defs";
import { CardFieldsSection } from "@/features/admin/components/card-fields-section";
import { useCheckCandidateCard } from "@/features/admin/hooks/use-admin-card-mutations";

export function CompareSourcesDialog({
  open,
  onOpenChange,
  card,
  sources,
  fields,
  providerSettings,
  invalidates,
  isAdmin,
  focusField,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: AdminCardResponse;
  sources: CandidateCardResponse[];
  fields: FieldDef<CandidateCardFieldKey>[];
  providerSettings: ProviderSettingResponse[];
  invalidates: readonly (readonly unknown[])[];
  isAdmin: boolean;
  focusField?: string;
}) {
  const checkCandidateCard = useCheckCandidateCard(invalidates);
  const openSourceIds = sources
    .filter((source) => source.provider !== USER_SUBMISSION_PROVIDER && source.checkedAt === null)
    .map((source) => source.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Compare all sources</DialogTitle>
        </DialogHeader>
        <CardFieldsSection
          card={card}
          sources={sources}
          candidateCardFields={fields}
          providerSettings={providerSettings}
          onCheckAllSources={() => {
            for (const id of openSourceIds) {
              checkCandidateCard.mutate(id);
            }
          }}
          isCheckingAllSources={checkCandidateCard.isPending}
          invalidates={invalidates}
          isAdmin={isAdmin}
          focusField={focusField}
        />
      </DialogContent>
    </Dialog>
  );
}

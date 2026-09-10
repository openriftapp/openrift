import type { AdminCardDetailResponse, AdminCardResponse } from "@openrift/shared/types/api/admin";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { useProviderSettings } from "@/features/admin/hooks/use-provider-settings";
import { CardFieldDisagreements } from "@/features/catalog-admin/components/card-field-disagreements";
import { CardFieldInputs } from "@/features/catalog-admin/components/card-field-inputs";
import { CardIdRow } from "@/features/catalog-admin/components/card-id-row";
import { useCompareOptionSets } from "@/features/catalog-admin/hooks/use-compare-options";
import { useSaveCardFields } from "@/features/catalog-admin/hooks/use-save-card-fields";
import {
  applyFieldValue,
  cardFormFromCard,
  cardFormState,
} from "@/features/catalog-admin/lib/card-field-form";
import { buildCompareColumns } from "@/features/catalog-admin/lib/compare-columns";
import { buildSourceDiff } from "@/features/catalog-admin/lib/field-source-diff";

function CardFieldsEditor({
  card,
  detail,
  cardSlug,
}: {
  card: AdminCardResponse;
  detail: AdminCardDetailResponse;
  cardSlug: string;
}) {
  const { data: providerSettingsData } = useProviderSettings();
  const optionSets = useCompareOptionSets();
  const saveFields = useSaveCardFields(cardSlug);
  const [form, setForm] = useState(() => cardFormFromCard(card));

  const { changes, issues } = cardFormState(form, card);
  const diff = buildSourceDiff(
    detail,
    buildCompareColumns(detail, providerSettingsData.providerSettings),
    optionSets,
  );
  const printing = detail.printings.toSorted((a, b) => a.canonicalRank - b.canonicalRank).at(0);

  async function save() {
    const saved = await saveFields.run(card.id, changes);
    if (!saved) {
      return;
    }
    toast.success(`Saved ${changes.length} field${changes.length === 1 ? "" : "s"}`);
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Card fields</h2>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {changes.length === 0
                ? "No unsaved changes"
                : `${changes.length} unsaved change${changes.length === 1 ? "" : "s"}`}
            </span>
            <Button
              variant="outline"
              disabled={changes.length === 0 || saveFields.isPending}
              onClick={() => setForm(cardFormFromCard(card))}
            >
              Cancel
            </Button>
            <Button
              disabled={changes.length === 0 || issues.length > 0 || saveFields.isPending}
              onClick={() => void save()}
            >
              Save
            </Button>
          </div>
        </div>

        {issues.length > 0 && (
          <ul className="text-destructive space-y-1 text-sm">
            {issues.map((issue) => (
              <li key={issue.field}>{issue.message}</li>
            ))}
          </ul>
        )}

        <CardIdRow card={card} expectedCardId={detail.expectedCardId} />

        <CardFieldInputs
          form={form}
          onChange={(next) => setForm((current) => ({ ...current, ...next }))}
          printedText={
            printing === undefined
              ? null
              : { rules: printing.printedRulesText, effect: printing.printedEffectText }
          }
        />
      </section>

      <CardFieldDisagreements
        diff={diff}
        cardSlug={cardSlug}
        onUse={(field, value) => setForm((current) => applyFieldValue(current, field, value))}
      />
    </div>
  );
}

export function CardFieldsTab({
  detail,
  cardSlug,
}: {
  detail: AdminCardDetailResponse;
  cardSlug: string;
}) {
  if (detail.card === null) {
    return (
      <Empty>
        <EmptyDescription>
          This name has no card yet, so there are no fields to edit.
        </EmptyDescription>
      </Empty>
    );
  }
  return <CardFieldsEditor card={detail.card} detail={detail} cardSlug={cardSlug} />;
}

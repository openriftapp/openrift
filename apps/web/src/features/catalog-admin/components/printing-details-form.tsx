import { CheckIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PrintingDetailFields } from "@/features/catalog-admin/components/printing-detail-fields";
import { PrintingTextFields } from "@/features/catalog-admin/components/printing-text-fields";
import type { PrintingDraft } from "@/features/catalog-admin/lib/printing-edits";
import { printingDraftIsValid } from "@/features/catalog-admin/lib/printing-edits";

export function PrintingDetailsForm({
  printingId,
  draft,
  onDraftChange,
  onCancel,
  onSave,
  isSaving,
}: {
  printingId: string;
  draft: PrintingDraft;
  onDraftChange: (next: PrintingDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const patch = (next: Partial<PrintingDraft>) => onDraftChange({ ...draft, ...next });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-medium">Details</h3>
        <Button size="sm" disabled={isSaving || !printingDraftIsValid(draft)} onClick={onSave}>
          <CheckIcon />
          Save
        </Button>
        <Button variant="ghost" size="sm" disabled={isSaving} onClick={onCancel}>
          <XIcon />
          Cancel
        </Button>
      </div>

      <PrintingDetailFields printingId={printingId} draft={draft} onPatch={patch} />
      <PrintingTextFields printingId={printingId} draft={draft} onPatch={patch} />
    </section>
  );
}

import { enumLabel } from "@openrift/shared/enum-label";
import type { AdminPrintingResponse } from "@openrift/shared/types/api/admin";
import { Link } from "@tanstack/react-router";
import { CopyIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  useAcceptPrintingField,
  useDeletePrinting,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { PrintingDetailsForm } from "@/features/catalog-admin/components/printing-details-form";
import { formatFieldValue } from "@/features/catalog-admin/lib/catalog-field-labels";
import type { PrintingDraft } from "@/features/catalog-admin/lib/printing-edits";
import { printingDraft, printingDraftChanges } from "@/features/catalog-admin/lib/printing-edits";
import { useEnumOrders } from "@/hooks/use-enums";
import { useLanguages } from "@/hooks/use-languages";
import { useMarkers } from "@/hooks/use-markers";

function DetailList({ pairs }: { pairs: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm">
      {pairs.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="break-words whitespace-pre-wrap">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PrintingDetails({
  printing,
  cardSlug,
  isAdmin,
}: {
  printing: AdminPrintingResponse;
  cardSlug: string;
  isAdmin: boolean;
}) {
  const { labels } = useEnumOrders();
  const { data: markersData } = useMarkers();
  const { data: languagesData } = useLanguages();
  const acceptField = useAcceptPrintingField();
  const deletePrinting = useDeletePrinting();
  const [draft, setDraft] = useState<PrintingDraft | null>(null);

  const markerLabels = Object.fromEntries(
    markersData.markers.map((marker) => [marker.slug, marker.label]),
  );
  const languageName =
    languagesData.languages.find((language) => language.code === printing.language)?.name ??
    printing.language;

  async function save(next: PrintingDraft) {
    const changes = printingDraftChanges(printing, next);
    try {
      await Promise.all(
        changes.map((change) =>
          acceptField.mutateAsync({
            printingId: printing.id,
            field: change.field,
            value: change.value,
            source: "manual",
          }),
        ),
      );
    } catch {
      // Reported by the global mutation error toast.
      return;
    }
    setDraft(null);
  }

  if (draft !== null) {
    return (
      <PrintingDetailsForm
        printingId={printing.id}
        draft={draft}
        onDraftChange={setDraft}
        onCancel={() => setDraft(null)}
        onSave={() => void save(draft)}
        isSaving={acceptField.isPending}
      />
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-medium">Details</h3>
        <Button variant="outline" size="sm" onClick={() => setDraft(printingDraft(printing))}>
          <PencilIcon />
          Edit
        </Button>
        {isAdmin && (
          <>
            <Button
              variant="ghost"
              size="sm"
              render={
                <Link
                  to="/admin/cards/$cardSlug/printings/create"
                  params={{ cardSlug }}
                  search={{ duplicateFrom: printing.id }}
                />
              }
            >
              <CopyIcon />
              Duplicate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={deletePrinting.isPending}
              onClick={() => {
                if (
                  globalThis.confirm(
                    `Delete printing ${printing.expectedPrintingId}? This cannot be undone.`,
                  )
                ) {
                  deletePrinting.mutate(printing.id);
                }
              }}
            >
              <Trash2Icon />
              Delete
            </Button>
          </>
        )}
      </div>

      <DetailList
        pairs={[
          ["Set", printing.setName ?? printing.setSlug],
          ["Rarity", enumLabel(labels.rarities, printing.rarity)],
          ["Finish", enumLabel(labels.finishes, printing.finish)],
          ["Size", enumLabel(labels.cardSizes, printing.size)],
          ["Art variant", enumLabel(labels.artVariants, printing.artVariant)],
          ["Artist", printing.artist],
          ["Public code", printing.publicCode],
          ["Printed name", formatFieldValue(printing.printedName)],
          ["Printed year", formatFieldValue(printing.printedYear)],
          [
            "Markers",
            formatFieldValue(printing.markerSlugs.map((slug) => enumLabel(markerLabels, slug))),
          ],
          ["Distribution channels", formatFieldValue(printing.distributionChannelSlugs)],
          ["Language", languageName],
          ["Comment", formatFieldValue(printing.comment)],
          ["Printed rules text", formatFieldValue(printing.printedRulesText)],
          ["Printed effect text", formatFieldValue(printing.printedEffectText)],
          ["Flavor text", formatFieldValue(printing.flavorText)],
        ]}
      />
    </section>
  );
}

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CardList } from "@/components/ui/card-list";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAdminPrintingCitations,
  useCreatePrintingCitation,
  useDeletePrintingCitation,
  useUpdatePrintingCitation,
} from "@/features/admin/hooks/use-admin-printing-citations";
import { PrintingLinkRow } from "@/features/catalog-admin/components/printing-link-row";

export function PrintingLinks({ printingId }: { printingId: string }) {
  const { data, isPending } = useAdminPrintingCitations(printingId);
  const createCitation = useCreatePrintingCitation();
  const updateCitation = useUpdatePrintingCitation();
  const deleteCitation = useDeletePrintingCitation();
  const [label, setLabel] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const citations = data?.citations ?? [];
  const isBusy = updateCitation.isPending || deleteCitation.isPending;

  async function saveCitation(
    citationId: string,
    next: { label: string; sourceUrl: string | null },
  ): Promise<boolean> {
    try {
      await updateCitation.mutateAsync({ printingId, citationId, ...next });
    } catch {
      // Reported by the global mutation error toast; the row keeps the draft.
      return false;
    }
    return true;
  }

  return (
    <section className="space-y-3">
      <h3 className="text-base font-medium">Source links</h3>
      <p className="text-muted-foreground text-sm">
        Where this printing&apos;s claims come from. These show on the public card page.
      </p>

      {isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : citations.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No links yet, so the card page shows no source line.
        </p>
      ) : (
        <CardList>
          {citations.map((citation) => (
            <PrintingLinkRow
              key={citation.id}
              citation={citation}
              isBusy={isBusy}
              onSave={(next) => saveCitation(citation.id, next)}
              onDelete={() => deleteCitation.mutate({ printingId, citationId: citation.id })}
            />
          ))}
        </CardList>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="New link label"
          placeholder="Launch party unboxing (RiftboundDaily)"
          value={label}
          className="min-w-48 flex-1"
          onChange={(event) => setLabel(event.target.value)}
        />
        <Input
          aria-label="New link address"
          placeholder="https://…"
          value={sourceUrl}
          className="min-w-48 flex-1"
          onChange={(event) => setSourceUrl(event.target.value)}
        />
        <Button
          variant="outline"
          disabled={label.trim().length === 0 || createCitation.isPending}
          onClick={() =>
            createCitation.mutate(
              {
                printingId,
                label: label.trim(),
                sourceUrl: sourceUrl.trim() || null,
              },
              {
                onSuccess: () => {
                  setLabel("");
                  setSourceUrl("");
                },
              },
            )
          }
        >
          <PlusIcon />
          Add link
        </Button>
      </div>
    </section>
  );
}

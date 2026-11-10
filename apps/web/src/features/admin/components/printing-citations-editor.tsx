import { SourceCitationsEditor } from "@/features/admin/components/source-citations-editor";
import {
  useAdminPrintingCitations,
  useCreatePrintingCitation,
  useDeletePrintingCitation,
  useUpdatePrintingCitation,
} from "@/features/admin/hooks/use-admin-printing-citations";

/**
 * Every row here is hand-entered. A desk holder may change only the links they
 * added, so the others show as locked.
 */
export function PrintingCitationsEditor({
  printingId,
  adding,
  onAddingChange,
}: {
  printingId: string;
  adding?: boolean;
  onAddingChange?: (adding: boolean) => void;
}) {
  const { data, isPending } = useAdminPrintingCitations(printingId);
  const createCitation = useCreatePrintingCitation();
  const updateCitation = useUpdatePrintingCitation();
  const deleteCitation = useDeletePrintingCitation();

  return (
    <SourceCitationsEditor
      citations={data?.citations ?? []}
      isPending={isPending}
      adding={adding}
      onAddingChange={onAddingChange}
      hideWhenIdle={adding !== undefined}
      labelPlaceholder="Launch party unboxing (RiftboundDaily)"
      creating={createCitation.isPending || updateCitation.isPending}
      deleting={deleteCitation.isPending}
      onAdd={(input) => createCitation.mutateAsync({ printingId, ...input })}
      onUpdate={(citationId, input) =>
        updateCitation.mutateAsync({ printingId, citationId, ...input })
      }
      onDelete={(citationId) => deleteCitation.mutate({ printingId, citationId })}
      lockedReason={(citation) => (citation.canEdit ? null : "Added by someone else")}
    />
  );
}

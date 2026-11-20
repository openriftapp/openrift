import type { AdminPrintingCitation } from "@openrift/shared/types/api/admin";

import { SourceCitationsEditor } from "@/features/admin/components/source-citations-editor";
import {
  useAdminPrintingCitations,
  useCreatePrintingCitation,
  useDeletePrintingCitation,
  useUpdatePrintingCitation,
} from "@/features/admin/hooks/use-admin-printing-citations";
import type { RunWrite } from "@/features/admin/lib/run-write";
import { runWriteDirectly } from "@/features/admin/lib/run-write";

/**
 * Every row here is hand-entered. A desk holder may change only the links they
 * added, so the others show as locked.
 */
export function PrintingCitationsEditor({
  printingId,
  adding,
  onAddingChange,
  runWrite = runWriteDirectly,
}: {
  printingId: string;
  adding?: boolean;
  onAddingChange?: (adding: boolean) => void;
  runWrite?: RunWrite;
}) {
  const { data, isPending } = useAdminPrintingCitations(printingId);
  return (
    <PrintingCitationsEditorView
      printingId={printingId}
      citations={data?.citations ?? []}
      isPending={isPending}
      adding={adding}
      onAddingChange={onAddingChange}
      runWrite={runWrite}
    />
  );
}

export function PrintingCitationsEditorView({
  printingId,
  citations,
  isPending,
  adding,
  onAddingChange,
  runWrite = runWriteDirectly,
}: {
  printingId: string;
  citations: AdminPrintingCitation[];
  isPending: boolean;
  adding?: boolean;
  onAddingChange?: (adding: boolean) => void;
  runWrite?: RunWrite;
}) {
  const createCitation = useCreatePrintingCitation();
  const updateCitation = useUpdatePrintingCitation();
  const deleteCitation = useDeletePrintingCitation();

  return (
    <SourceCitationsEditor
      citations={citations}
      isPending={isPending}
      adding={adding}
      onAddingChange={onAddingChange}
      hideWhenIdle={adding !== undefined}
      labelPlaceholder="Launch party unboxing (RiftboundDaily)"
      creating={createCitation.isPending || updateCitation.isPending}
      deleting={deleteCitation.isPending}
      onAdd={(input) =>
        runWrite((signal) => createCitation.mutateAsync({ printingId, ...input }, { signal }))
      }
      onUpdate={(citationId, input) =>
        runWrite((signal) =>
          updateCitation.mutateAsync({ printingId, citationId, ...input }, { signal }),
        )
      }
      onDelete={(citationId) =>
        void runWrite((signal) =>
          deleteCitation.mutateAsync({ printingId, citationId }, { signal }),
        )
      }
      lockedReason={(citation) => (citation.canEdit ? null : "Added by someone else")}
    />
  );
}

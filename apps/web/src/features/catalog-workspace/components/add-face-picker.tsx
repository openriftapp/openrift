import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";

import { SideSearch } from "@/features/admin/components/side-search";
import { useSetDeskSecondSide } from "@/features/admin/hooks/use-printing-desk";
import type { RunWrite } from "@/features/admin/lib/run-write";
import { runWriteDirectly } from "@/features/admin/lib/run-write";
import { errorText } from "@/lib/error-text";

export function AddFacePicker({
  printing,
  runWrite = runWriteDirectly,
}: {
  printing: Pick<DeskPrintingRow, "printingId" | "faceId">;
  runWrite?: RunWrite;
}) {
  const setFace = useSetDeskSecondSide({ inlineError: true });

  return (
    <div className="space-y-2">
      <SideSearch
        excludeFaceIds={[printing.faceId]}
        disabled={setFace.isPending}
        onPick={(side) =>
          void runWrite((signal) =>
            setFace.mutateAsync(
              { printingId: printing.printingId, faceId: side.faceId },
              { signal },
            ),
          )
        }
      />
      {setFace.error && (
        <p className="text-destructive text-sm">
          {errorText(setFace.error, "Could not add the face.")}
        </p>
      )}
    </div>
  );
}

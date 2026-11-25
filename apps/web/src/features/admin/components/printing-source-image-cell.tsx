import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { useSetCandidatePrintingImage } from "@/features/admin/hooks/use-admin-image-mutations";
import type { RunWrite } from "@/features/admin/lib/run-write";
import { runWriteDirectly } from "@/features/admin/lib/run-write";

export function PrintingSourceImageCell({
  candidatePrintingId,
  url,
  sourceLabel,
  isUsed,
  landscape,
  invalidates,
  runWrite = runWriteDirectly,
}: {
  candidatePrintingId: string;
  url: string;
  sourceLabel: string;
  isUsed: boolean;
  landscape: boolean;
  invalidates?: readonly (readonly unknown[])[];
  runWrite?: RunWrite;
}) {
  const setSourceImage = useSetCandidatePrintingImage(invalidates);
  const store = (mode: "main" | "additional") =>
    void runWrite((signal) =>
      setSourceImage.mutateAsync({ candidatePrintingId, mode }, { signal }),
    );

  return (
    <span className="block space-y-1">
      <PrintingImageBox url={url} alt={`${sourceLabel} image`} href={url} landscape={landscape} />
      {isUsed ? (
        <span className="text-muted-foreground block text-xs">Already used</span>
      ) : (
        <span className="flex gap-1">
          <Button
            variant="outline"
            size="xs"
            disabled={setSourceImage.isPending}
            onClick={(e) => {
              e.stopPropagation();
              store("main");
            }}
          >
            <PlusIcon />
            Main
          </Button>
          <Button
            variant="ghost"
            size="xs"
            disabled={setSourceImage.isPending}
            onClick={(e) => {
              e.stopPropagation();
              store("additional");
            }}
          >
            <PlusIcon />
            Beside
          </Button>
        </span>
      )}
    </span>
  );
}

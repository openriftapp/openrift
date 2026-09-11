import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { useSetCandidatePrintingImage } from "@/features/admin/hooks/use-admin-image-mutations";

export function PrintingSourceImageCell({
  candidatePrintingId,
  url,
  sourceLabel,
  isUsed,
}: {
  candidatePrintingId: string;
  url: string;
  sourceLabel: string;
  isUsed: boolean;
}) {
  const setSourceImage = useSetCandidatePrintingImage();

  return (
    <span className="block space-y-1">
      <PrintingImageBox url={url} alt={`${sourceLabel} image`} href={url} />
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
              setSourceImage.mutate({ candidatePrintingId, mode: "main" });
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
              setSourceImage.mutate({ candidatePrintingId, mode: "additional" });
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

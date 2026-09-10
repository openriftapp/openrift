import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { deduplicateSourceImages } from "@/features/admin/components/card-detail-shared";
import { useSetCandidatePrintingImage } from "@/features/admin/hooks/use-admin-image-mutations";

export function PrintingSourceImages({
  printingId,
  detail,
}: {
  printingId: string;
  detail: AdminCardDetailResponse;
}) {
  const setSourceImage = useSetCandidatePrintingImage();

  const ownUrls = new Set(
    detail.printingImages
      .filter((image) => image.printingId === printingId)
      .map((image) => image.originalUrl),
  );
  const sourceNames = Object.fromEntries(
    detail.sources.map((source) => [source.id, source.submittedByName ?? source.provider]),
  );
  const candidates = detail.candidatePrintings.filter(
    (candidate) =>
      candidate.printingId === printingId &&
      candidate.imageUrl !== null &&
      !ownUrls.has(candidate.imageUrl),
  );
  const sourceImages = deduplicateSourceImages(candidates, sourceNames);

  if (sourceImages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm">
        Images a source found for this printing. Add one as the main art, or beside it.
      </p>
      <div className="flex flex-wrap gap-2">
        {sourceImages.map((source) => (
          <div key={source.candidatePrintingId} className="ring-border w-40 rounded-lg p-2 ring-1">
            <a href={source.url} target="_blank" rel="noreferrer">
              <ImgWithFallback
                src={source.url}
                alt={`${source.source} image`}
                className="aspect-card w-full rounded-md border object-contain"
                fallback={<span className="text-muted-foreground text-2xs">Failed to load</span>}
              />
            </a>
            <p className="text-muted-foreground mt-1.5 truncate text-xs">{source.source}</p>
            <div className="mt-1 flex gap-1">
              <Button
                variant="outline"
                size="xs"
                disabled={setSourceImage.isPending}
                onClick={() =>
                  setSourceImage.mutate({
                    candidatePrintingId: source.candidatePrintingId,
                    mode: "main",
                  })
                }
              >
                <PlusIcon />
                Main
              </Button>
              <Button
                variant="ghost"
                size="xs"
                disabled={setSourceImage.isPending}
                onClick={() =>
                  setSourceImage.mutate({
                    candidatePrintingId: source.candidatePrintingId,
                    mode: "additional",
                  })
                }
              >
                <PlusIcon />
                Beside
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import type {
  AdminCardDetailResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { useState } from "react";

import { ImagePreview } from "@/features/admin/components/image-preview";
import { PrintingImageAdd } from "@/features/catalog-admin/components/printing-image-add";
import { PrintingImageTile } from "@/features/catalog-admin/components/printing-image-tile";
import { PrintingSourceImages } from "@/features/catalog-admin/components/printing-source-images";
import { PrintingSubstituteArt } from "@/features/catalog-admin/components/printing-substitute-art";
import {
  activeFrontImage,
  printingImageFullSrc,
  printingImagesOf,
} from "@/features/catalog-admin/lib/printing-images";

export function PrintingImages({
  printing,
  detail,
  isAdmin,
}: {
  printing: AdminPrintingResponse;
  detail: AdminCardDetailResponse;
  isAdmin: boolean;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const images = printingImagesOf(printing.id, detail.printingImages);
  const preview = images.find((image) => image.id === previewId);

  return (
    <section className="space-y-3">
      <h3 className="text-base font-medium">Images</h3>

      {images.length === 0 ? (
        <p className="text-muted-foreground text-sm">No image on this printing yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {images.map((image) => (
            <PrintingImageTile
              key={image.id}
              image={image}
              isAdmin={isAdmin}
              isPreviewing={image.id === previewId}
              onPreview={() => {
                setPreviewId(image.id === previewId ? null : image.id);
                setResolution(null);
                setImgError(false);
              }}
            />
          ))}
        </div>
      )}

      {preview && (
        <div className="max-w-96">
          <ImagePreview
            url={printingImageFullSrc(preview)}
            alt={printing.expectedPrintingId}
            resolution={resolution}
            setResolution={setResolution}
            imgError={imgError}
            setImgError={setImgError}
          />
        </div>
      )}

      <PrintingSourceImages printingId={printing.id} detail={detail} />

      {isAdmin && <PrintingImageAdd printingId={printing.id} />}

      {activeFrontImage(printing.id, detail.printingImages) === undefined && (
        <PrintingSubstituteArt
          printing={printing}
          printings={detail.printings}
          images={detail.printingImages}
        />
      )}
    </section>
  );
}

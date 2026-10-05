import { ImageUpIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/ui/dropzone";
import { FieldError } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { useImageUpload } from "@/features/designer/hooks/use-image-upload";
import { CARD_MAX_ZOOM, CARD_MIN_ZOOM } from "@/features/designer/lib/card-designer";
import { useCardDesignerStore } from "@/features/designer/stores/card-designer-store";
import { m } from "@/paraglide/messages.js";

export function BackgroundImageControl() {
  const dataUrl = useCardDesignerStore((state) => state.background.dataUrl);
  const scale = useCardDesignerStore((state) => state.background.scale);
  const setImageTransform = useCardDesignerStore((state) => state.setImageTransform);
  const clearImage = useCardDesignerStore((state) => state.clearImage);
  const { handleFile, loading, error } = useImageUpload();

  return (
    <div className="flex flex-col gap-3">
      <Dropzone
        accept="image/*"
        disabled={loading}
        icon={<ImageUpIcon className="text-muted-foreground size-5" />}
        label={dataUrl ? m.designer_background_replace() : m.designer_background_upload()}
        onFiles={([file]) => {
          if (file) {
            void handleFile(file);
          }
        }}
      />
      {error && <FieldError>{error}</FieldError>}
      {dataUrl && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{m.designer_background_zoom()}</span>
            <Slider
              aria-label={m.designer_background_zoom_aria()}
              min={CARD_MIN_ZOOM}
              max={CARD_MAX_ZOOM}
              step={0.01}
              value={scale}
              onValueChange={(value) => {
                setImageTransform({ scale: typeof value === "number" ? value : value[0] });
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">{m.designer_background_drag_hint()}</p>
            <Button type="button" variant="ghost" size="sm" onClick={clearImage}>
              <Trash2Icon className="size-4" />
              {m.designer_background_remove()}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

import { ImagePlusIcon, UploadIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/ui/dropzone";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  useAddImageFromUrl,
  useUploadPrintingImage,
} from "@/features/admin/hooks/use-admin-image-mutations";

type Slot = "main" | "additional";
type Face = "front" | "back";

const SLOT_LABELS: Record<Slot, string> = { main: "Main art", additional: "Beside it" };
const FACE_LABELS: Record<Face, string> = { front: "Front", back: "Back" };

export function PrintingImageAdd({ printingId }: { printingId: string }) {
  const uploadImage = useUploadPrintingImage();
  const addImageFromUrl = useAddImageFromUrl();
  const [slot, setSlot] = useState<Slot>("main");
  const [face, setFace] = useState<Face>("front");
  const [url, setUrl] = useState("");
  const [showUrl, setShowUrl] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          variant="outline"
          spacing={0}
          aria-label="Where the image goes"
          value={[slot]}
          onValueChange={([next]) => {
            if (next === "main" || next === "additional") {
              setSlot(next);
            }
          }}
        >
          {(["main", "additional"] as const).map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {SLOT_LABELS[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          variant="outline"
          spacing={0}
          aria-label="Card face"
          value={[face]}
          onValueChange={([next]) => {
            if (next === "front" || next === "back") {
              setFace(next);
            }
          }}
        >
          {(["front", "back"] as const).map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {FACE_LABELS[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-wrap items-start gap-2">
        <Dropzone
          className="min-w-64 flex-1"
          accept="image/*"
          disabled={uploadImage.isPending}
          label="Drop an image, or click to choose one"
          icon={<UploadIcon className="size-4" />}
          onFiles={(files) => {
            const file = files.at(0);
            if (file) {
              uploadImage.mutate({ printingId, file, mode: slot, face });
            }
          }}
        />
        <Button variant="outline" onClick={() => setShowUrl((open) => !open)}>
          <ImagePlusIcon />
          By URL
        </Button>
      </div>

      {showUrl && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Image URL"
            placeholder="https://…"
            value={url}
            className="max-w-md flex-1"
            onChange={(event) => setUrl(event.target.value)}
          />
          <Button
            variant="outline"
            disabled={url.trim().length === 0 || addImageFromUrl.isPending}
            onClick={() =>
              addImageFromUrl.mutate(
                { printingId, url: url.trim(), mode: slot },
                {
                  onSuccess: () => {
                    setUrl("");
                    setShowUrl(false);
                  },
                },
              )
            }
          >
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

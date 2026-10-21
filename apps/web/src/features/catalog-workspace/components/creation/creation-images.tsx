import { UploadIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/ui/dropzone";
import type { DraftImage } from "@/features/catalog-workspace/lib/creation-draft";

function FileThumb({ file, alt }: { file: File; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    // oxlint-disable-next-line react/set-state-in-effect -- the object URL is revoked on cleanup, so it is made here
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return <ThumbFrame src={url} alt={alt} />;
}

function ThumbFrame({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="bg-muted aspect-[63/88] w-12 min-w-0 overflow-hidden rounded-sm">
      {src !== null && <img src={src} alt={alt} className="size-full object-cover" />}
    </div>
  );
}

function DraftImageThumb({ image }: { image: DraftImage }) {
  return image.kind === "file" ? (
    <FileThumb file={image.file} alt={image.file.name} />
  ) : (
    <ThumbFrame src={image.url} alt={image.label} />
  );
}

export function draftImageLabel(image: DraftImage): string {
  return image.kind === "file" ? image.file.name : image.label;
}

export function CreationImagesSummary({ images }: { images: readonly DraftImage[] }) {
  if (images.length === 0) {
    return <span className="text-muted-foreground">No image yet</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      {images.map((image) => (
        <DraftImageThumb key={image.key} image={image} />
      ))}
      <span>{images.map((image) => draftImageLabel(image)).join(", ")}</span>
    </span>
  );
}

export function CreationImages({
  images,
  onChange,
  disabled = false,
}: {
  images: readonly DraftImage[];
  onChange: (images: DraftImage[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {images.map((image) => (
            <li key={image.key} className="flex flex-col items-start gap-1">
              <DraftImageThumb image={image} />
              <span className="text-muted-foreground max-w-24 truncate text-xs">
                {draftImageLabel(image)}
              </span>
              <Button
                variant="ghost"
                size="xs"
                disabled={disabled}
                onClick={() => onChange(images.filter((other) => other.key !== image.key))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dropzone
        multiple
        accept="image/*"
        disabled={disabled}
        icon={<UploadIcon className="text-muted-foreground size-5" />}
        label="Drop images here or click to choose"
        hint="Uploaded once the printing is created."
        onFiles={(files) =>
          onChange([
            ...images,
            ...files.map((file): DraftImage => ({ kind: "file", key: crypto.randomUUID(), file })),
          ])
        }
      />
    </div>
  );
}

import { CardArtThumb } from "@/features/cards/components/card-art-thumb";

export function UserProfilePreviewFan({
  previews,
}: {
  previews: readonly { imageId: string; landscape: boolean }[];
}) {
  if (previews.length === 0) {
    return null;
  }
  return (
    <div className="flex shrink-0 items-center justify-end gap-1.5">
      {previews.map(({ imageId, landscape }) => (
        <CardArtThumb
          key={imageId}
          imageId={imageId}
          landscape={landscape}
          loading="lazy"
          className="ring-border w-10 ring-1"
        />
      ))}
    </div>
  );
}

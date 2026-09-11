import { imageUrl } from "@openrift/shared/image-url";

export function UserProfilePreviewFan({ imageIds }: { imageIds: readonly string[] }) {
  if (imageIds.length === 0) {
    return null;
  }
  return (
    <div className="flex shrink-0 items-center justify-end gap-1.5">
      {imageIds.map((imageId) => (
        <img
          key={imageId}
          src={imageUrl(imageId, "120w")}
          alt=""
          loading="lazy"
          className="ring-border aspect-[63/88] w-10 shrink-0 rounded-sm object-cover ring-1"
        />
      ))}
    </div>
  );
}

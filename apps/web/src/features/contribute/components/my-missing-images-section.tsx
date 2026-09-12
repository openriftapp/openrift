import { Heading } from "@/components/heading";
import { MissingImagesList } from "@/features/contribute/components/missing-images-list";
import { MissingImagesTiles } from "@/features/contribute/components/missing-images-tiles";
import { useMyMissingImages } from "@/features/contribute/hooks/use-missing-images";

export function MyMissingImagesSection({ layout = "list" }: { layout?: "list" | "tiles" }) {
  const { data } = useMyMissingImages();

  const items = data?.items ?? [];
  const count = items.length;
  if (count === 0) {
    return null;
  }

  const single = count === 1;

  return (
    <section className="flex flex-col gap-3">
      <Heading level={2}>
        {single
          ? "We don't have a photo for one of your owned cards"
          : `We don't have photos for ${count} of your owned cards`}
      </Heading>
      <p className="text-muted-foreground">
        Could you snap {single ? "it" : "them"} for us? Every photo helps, and it earns you a
        Contributor badge on your profile.
      </p>
      {layout === "tiles" ? (
        <MissingImagesTiles items={items} />
      ) : (
        <MissingImagesList items={items} />
      )}
    </section>
  );
}

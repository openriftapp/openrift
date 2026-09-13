import { Heading } from "@/components/heading";
import { MissingImagesList } from "@/features/contribute/components/missing-images-list";
import { MissingImagesTiles } from "@/features/contribute/components/missing-images-tiles";
import { useMyMissingImages } from "@/features/contribute/hooks/use-missing-images";
import { m } from "@/paraglide/messages.js";

export function MyMissingImagesSection({ layout = "list" }: { layout?: "list" | "tiles" }) {
  const { data } = useMyMissingImages();

  const items = data?.items ?? [];
  const count = items.length;
  if (count === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <Heading level={2}>{m.contribute_missing_heading({ count })}</Heading>
      <p className="text-muted-foreground">{m.contribute_missing_lead({ count })}</p>
      {layout === "tiles" ? (
        <MissingImagesTiles items={items} />
      ) : (
        <MissingImagesList items={items} />
      )}
    </section>
  );
}

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

  const single = count === 1;

  return (
    <section className="flex flex-col gap-3">
      <Heading level={2}>
        {single
          ? m.contribute_missing_heading_one()
          : m.contribute_missing_heading_other({ count })}
      </Heading>
      <p className="text-muted-foreground">
        {single ? m.contribute_missing_lead_one() : m.contribute_missing_lead_other()}
      </p>
      {layout === "tiles" ? (
        <MissingImagesTiles items={items} />
      ) : (
        <MissingImagesList items={items} />
      )}
    </section>
  );
}

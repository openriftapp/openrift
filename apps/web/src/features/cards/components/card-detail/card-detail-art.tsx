import { getOrientation } from "@openrift/shared/card-orientation";
import type { Printing } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";

import { useDisplayStore } from "@/stores/display-store";

import { CardImage } from "./card-image";

export function CardDetailArt({
  printing,
  showImages,
  sizes,
  loading,
  frame,
}: {
  printing: Printing;
  showImages?: boolean;
  sizes?: string;
  loading?: "lazy";
  frame?: "portrait" | "native";
}) {
  const { card } = printing;
  const orientation = getOrientation(card.types);
  const foilEffect = useDisplayStore((s) => s.foilEffect);
  const showFoil = printing.finish === WellKnown.finish.FOIL && foilEffect;

  return (
    <CardImage
      printing={printing}
      orientation={orientation}
      showImages={showImages}
      showFoil={showFoil}
      showShimmer={showFoil}
      sizes={sizes}
      loading={loading}
      frame={frame}
    />
  );
}

import type { BoosterBasis } from "@openrift/shared/boosters/types";

import { Badge } from "@/components/ui/badge";
import { boosterBasisDescription, boosterBasisLabel } from "@/features/boosters/lib/booster-labels";

const BASIS_VARIANT = {
  official: "success",
  estimate: "info",
  guess: "violet",
} as const satisfies Record<BoosterBasis, string>;

export function BoosterBasisBadge({ basis }: { basis: BoosterBasis }) {
  return (
    <Badge variant={BASIS_VARIANT[basis]} title={boosterBasisDescription(basis)}>
      {boosterBasisLabel(basis)}
    </Badge>
  );
}

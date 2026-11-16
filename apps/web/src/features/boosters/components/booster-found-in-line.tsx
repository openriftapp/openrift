import type { CardDetailResponse } from "@openrift/shared/types/api/catalog";
import { Link } from "@tanstack/react-router";

import { InfoHint } from "@/components/ui/info-hint";
import { BoosterBasisBadge } from "@/features/boosters/components/booster-basis-badge";
import {
  boosterName,
  boosterOutcomeLabel,
  boosterSlotLabel,
  perPackLabel,
  perUnitLabel,
} from "@/features/boosters/lib/booster-labels";
import { formatCount } from "@/lib/format";
import { m } from "@/paraglide/messages.js";

type BoosterRow = CardDetailResponse["boosters"][number];

export function BoosterFoundInLine({
  row,
  language,
  setName,
}: {
  row: BoosterRow;
  language: string;
  setName: string;
}) {
  const perPack = row.outcomePerPack / row.poolSize;
  const packsPerCase = row.packsPerBox * row.boxesPerCase;
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <Link
        to="/products/$slug"
        params={{ slug: row.booster }}
        search={{ languages: [language] }}
        className="hover:text-foreground"
      >
        <span className="font-semibold underline decoration-dotted underline-offset-2">
          {boosterName(setName)}
        </span>
      </Link>
      <span className="text-muted-foreground">
        › {boosterSlotLabel(row.slot)} · {perUnitLabel(perPack, row.packsPerBox, "box", row.bound)}
      </span>
      <BoosterBasisBadge basis={row.basis} />
      <InfoHint label={m.booster_detail_label()}>
        <span className="block">
          {m.booster_detail_outcome({
            outcome: boosterOutcomeLabel(row.outcome),
            rate: perPackLabel(row.outcomePerPack, row.bound),
          })}
        </span>
        <span className="block">{m.booster_detail_pool({ count: formatCount(row.poolSize) })}</span>
        <span className="block">
          {m.booster_detail_printing({
            pack: perPackLabel(perPack, row.bound),
            box: perUnitLabel(perPack, row.packsPerBox, "box", row.bound),
            case: perUnitLabel(perPack, packsPerCase, "case", row.bound),
          })}
        </span>
      </InfoHint>
    </div>
  );
}

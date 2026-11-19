import type { Rarity } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import type { CSSProperties } from "react";

/** Positions as percentages of the 744x1039 printed frame image. */
export const CARD_FACE_REGION = {
  energy: { left: "6.32%", top: "5.39%", width: "10.48%", height: "7.51%" },
  might: { left: "84.54%", top: "5.39%", width: "8.2%", height: "6.26%" },
  typeLine: { left: "11.02%", top: "51.4%", height: "3.66%" },
  name: { left: "11.83%", right: "8%", top: "55.53%", height: "7.89%" },
  textBox: { left: "8.06%", right: "7%", top: "64.3%", bottom: "8.57%" },
  footer: { left: "5.1%", right: "11.3%", top: "95.57%", height: "2.7%" },
} satisfies Record<string, CSSProperties>;

/** Centre points of the marks the printed frame draws itself. */
export const CARD_FACE_MARK = {
  typeIcon: { left: "6.65%", top: "53.32%" },
  rarity: { left: "50%", top: "94.25%" },
  domain: { left: "93.1%", top: "96.6%" },
} satisfies Record<string, CSSProperties>;

export const CARD_TEXT_COLUMN_CLASS = "pr-[3cqw] pl-[3.34cqw]";

const COMMON_TYPE_ICON_COLOR = "#9b6026";
const GOLD_TYPE_ICON_COLOR = "#d4a43c";
const TYPE_ICON_COLORS: Partial<Record<Rarity, string>> = {
  [WellKnown.rarity.UNCOMMON]: "#a09e9d",
  [WellKnown.rarity.RARE]: GOLD_TYPE_ICON_COLOR,
  [WellKnown.rarity.EPIC]: GOLD_TYPE_ICON_COLOR,
  [WellKnown.rarity.SHOWCASE]: GOLD_TYPE_ICON_COLOR,
};

export function typeIconColor(rarity?: Rarity | null): string {
  return (rarity ? TYPE_ICON_COLORS[rarity] : undefined) ?? COMMON_TYPE_ICON_COLOR;
}

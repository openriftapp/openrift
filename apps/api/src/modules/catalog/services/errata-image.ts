import { SHARE_IMAGE_CANVAS } from "@openrift/shared/share-image-params";

import type { Io } from "../../../io.js";
import type { Element } from "../../system/services/share-image-core.js";
import {
  CARD_ASPECT,
  COLORS,
  cardTile,
  element,
  renderTreeToPng,
  tileArtDataUri,
} from "../../system/services/share-image-core.js";

export interface ErrataImageInput {
  cards: { cardName: string; imageId: string | null }[];
  cardCount: number;
  updateCount: number;
  siteHost?: string;
}

const PAD = 72;
const CARD_W = 236;
const CARD_H = Math.round(CARD_W / CARD_ASPECT);
const FAN_W = 470;
const FAN_SLOTS = [
  { left: Math.round((FAN_W - CARD_W) / 2), top: 118, rotate: 0, z: 3 },
  { left: 0, top: 156, rotate: -11, z: 1 },
  { left: FAN_W - CARD_W, top: 156, rotate: 11, z: 2 },
];

function stat(value: number, label: string): Element {
  return element(
    "div",
    { display: "flex", flexDirection: "column", gap: 6 },
    element(
      "div",
      { display: "flex", fontSize: 54, fontWeight: 700, lineHeight: 1 },
      String(value),
    ),
    element("div", { display: "flex", fontSize: 22, color: COLORS.muted }, label),
  );
}

export async function renderErrataImage(
  io: Io,
  input: ErrataImageInput,
  scale = 1,
): Promise<Buffer> {
  const { width, height } = SHARE_IMAGE_CANVAS.landscape;
  const cards = input.cards.slice(0, FAN_SLOTS.length);
  const arts = await Promise.all(
    cards.map((card) => tileArtDataUri(io, card.imageId, CARD_W, CARD_H, scale)),
  );
  const fanCards = cards
    .map((card, index) => ({ card, art: arts[index] ?? null, slot: FAN_SLOTS[index] }))
    .filter((item) => item.slot !== undefined)
    .toSorted((left, right) => (left.slot?.z ?? 0) - (right.slot?.z ?? 0));

  const fan = element(
    "div",
    { display: "flex", position: "relative", width: FAN_W, height, flexShrink: 0 },
    ...fanCards.map(({ card, art, slot }) =>
      element(
        "div",
        {
          display: "flex",
          position: "absolute",
          left: slot?.left ?? 0,
          top: slot?.top ?? 0,
          transform: `rotate(${slot?.rotate ?? 0}deg)`,
          boxShadow: "0 24px 48px rgba(0,0,0,0.55)",
          borderRadius: 12,
        },
        cardTile({ cardName: card.cardName }, art, CARD_W, CARD_H),
      ),
    ),
  );

  const text = element(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      flexGrow: 1,
      gap: 22,
    },
    element(
      "div",
      {
        display: "flex",
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: 3,
        color: COLORS.gold,
      },
      "WORDING CHANGES",
    ),
    element(
      "div",
      { display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 700, lineHeight: 1.04 },
      element("div", { display: "flex" }, "Riftbound"),
      element("div", { display: "flex" }, "card errata"),
    ),
    element("div", { display: "flex", width: 120, height: 3, backgroundColor: COLORS.gold }),
    element(
      "div",
      { display: "flex", gap: 48, marginTop: 6 },
      stat(input.cardCount, input.cardCount === 1 ? "card reworded" : "cards reworded"),
      stat(input.updateCount, input.updateCount === 1 ? "errata update" : "errata updates"),
    ),
    input.siteHost &&
      element(
        "div",
        { display: "flex", marginTop: 10, fontSize: 22, fontWeight: 600, color: COLORS.muted },
        input.siteHost,
      ),
  );

  const root = element(
    "div",
    {
      display: "flex",
      width,
      height,
      paddingLeft: PAD,
      paddingRight: PAD / 2,
      backgroundColor: COLORS.background,
      backgroundImage:
        "radial-gradient(60% 80% at 78% 50%, rgba(205,172,110,0.22) 0%, transparent 70%)",
      color: COLORS.text,
      fontFamily: "Hanken Grotesk",
      overflow: "hidden",
    },
    text,
    fan,
  );

  return renderTreeToPng(io, root, width, height, scale);
}

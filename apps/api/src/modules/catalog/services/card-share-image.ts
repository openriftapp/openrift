import { CARD_ASPECT } from "@openrift/shared/card-orientation";
import { SHARE_IMAGE_CANVAS } from "@openrift/shared/share-image-params";

import type { Io } from "../../../io.js";
import type { Element } from "../../system/services/share-image-core.js";
import {
  COLORS,
  cardTile,
  elideTitle,
  element,
  qrDataUri,
  qrMark,
  renderTreeToPng,
  tileArtDataUri,
} from "../../system/services/share-image-core.js";
import { GOLD_GLOW, hostLabel, shareCanvas } from "../../system/services/share-image-frame.js";
import type { CardShareImageInput } from "./card-share-input.js";

const PAD = 40;
const COLUMN_GAP = 44;
const CARD_H = 550;
const CARD_W = Math.round(CARD_H * CARD_ASPECT);
const THUMB_W = 72;
const THUMB_H = Math.round(THUMB_W / CARD_ASPECT);
const QR = 116;
const NAME_MAX_CHARS = 24;

function priceBlock(price: { label: string; value: string }): Element {
  return element(
    "div",
    { display: "flex", flexDirection: "column", gap: 4 },
    element("div", { display: "flex", fontSize: 20, color: COLORS.muted }, price.label),
    element("div", { display: "flex", fontSize: 46, fontWeight: 700, lineHeight: 1 }, price.value),
  );
}

export async function renderCardShareImage(
  io: Io,
  input: CardShareImageInput,
  scale = 1,
  withQr = true,
): Promise<Buffer> {
  const { width, height } = SHARE_IMAGE_CANVAS.landscape;
  const [art, thumbs, qr] = await Promise.all([
    tileArtDataUri(io, input.imageId, CARD_W, CARD_H, scale),
    Promise.all(input.otherImageIds.map((id) => tileArtDataUri(io, id, THUMB_W, THUMB_H, scale))),
    withQr && input.shareUrl ? qrDataUri(input.shareUrl, scale, QR) : Promise.resolve(null),
  ]);

  const header = element(
    "div",
    { display: "flex", flexDirection: "column", gap: 10 },
    element(
      "div",
      { display: "flex", fontSize: 54, fontWeight: 700, lineHeight: 1.05 },
      elideTitle(input.cardName, NAME_MAX_CHARS),
    ),
    input.typeLine &&
      element(
        "div",
        { display: "flex", fontSize: 26, fontWeight: 600, color: COLORS.gold },
        input.typeLine,
      ),
    element("div", { display: "flex", fontSize: 24, color: COLORS.muted }, input.detailLine),
  );

  const prices =
    input.prices.length > 0 &&
    element("div", { display: "flex", gap: COLUMN_GAP }, ...input.prices.map(priceBlock));

  const printings =
    input.printingCount > 1 &&
    element(
      "div",
      { display: "flex", flexDirection: "column", gap: 14 },
      element(
        "div",
        { display: "flex", fontSize: 20, color: COLORS.muted },
        `${input.printingCount} printings`,
      ),
      thumbs.length > 0 &&
        element(
          "div",
          { display: "flex", gap: 10 },
          ...thumbs.map((thumb) => cardTile({ cardName: input.cardName }, thumb, THUMB_W, THUMB_H)),
        ),
    );

  const footer = element(
    "div",
    { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 },
    element(
      "div",
      { display: "flex", flexDirection: "column", gap: 14 },
      printings,
      input.siteHost && hostLabel(input.siteHost, 24),
    ),
    qr && qrMark(qr, QR),
  );

  const root = shareCanvas(
    width,
    height,
    { padding: PAD, gap: COLUMN_GAP, backgroundImage: GOLD_GLOW },
    cardTile({ cardName: input.cardName }, art, CARD_W, CARD_H),
    element(
      "div",
      {
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        flexGrow: 1,
        minWidth: 0,
      },
      header,
      prices,
      footer,
    ),
  );

  return renderTreeToPng(io, root, width, height, scale);
}

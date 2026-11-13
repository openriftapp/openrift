import type { ShareImageAspect } from "@openrift/shared/share-image-params";
import { SHARE_IMAGE_CANVAS } from "@openrift/shared/share-image-params";

import type { Element } from "../../system/services/share-image-core.js";
import { COLORS, element, elideTitle } from "../../system/services/share-image-core.js";
import type { ShareTypeScale } from "../../system/services/share-image-frame.js";
import { SHARE_TYPE, titleBlock } from "../../system/services/share-image-frame.js";
import type { DeckImageInput } from "./deck-image-parts.js";

/**
 * `scale` picks resolution for one satori layout: 1x for the og:image
 * (1200x630), 2x for the download, embedding raster sources at that resolution.
 * Landscape and vertical are separate compositions, not one resized layout.
 * Vertical is download-only; no crawler consumes a 9:16 og:image.
 */

/** Per-canvas geometry. Everything that differs between the two compositions lives here, not branched on at each use. */
interface DeckCanvas extends ShareTypeScale {
  aspect: ShareImageAspect;
  width: number;
  height: number;
  /** Height the archive result line adds to the title area, gap included. */
  resultH: number;
  resultMaxChars: number;
  /** Legend domain glyphs, shown beside the card count (no amounts). */
  domainIcon: number;
}

export const LANDSCAPE: DeckCanvas = {
  ...SHARE_IMAGE_CANVAS.landscape,
  ...SHARE_TYPE.landscape,
  aspect: "landscape",
  titleMaxChars: 34,
  resultH: 30,
  resultMaxChars: 76,
  domainIcon: 30,
};

export const VERTICAL: DeckCanvas = {
  ...SHARE_IMAGE_CANVAS.vertical,
  ...SHARE_TYPE.vertical,
  aspect: "vertical",
  titleMaxChars: 32,
  resultH: 38,
  resultMaxChars: 58,
  domainIcon: 34,
};

export function titleTypeHeight(input: DeckImageInput, canvas: DeckCanvas): number {
  return canvas.titleH + (input.resultLine === undefined ? 0 : canvas.resultH);
}

function resultLineElement(line: string, canvas: DeckCanvas, marginTop: number): Element {
  return element(
    "div",
    {
      display: "flex",
      fontSize: canvas.metaSize,
      lineHeight: 1,
      fontWeight: 600,
      color: COLORS.text,
      marginTop,
      whiteSpace: "nowrap",
    },
    elideTitle(line, canvas.resultMaxChars),
  );
}

export function deckTitleBlock(
  input: DeckImageInput,
  canvas: DeckCanvas,
  metaLabel: string,
  domainIcons: readonly Element[],
  qrUri: string | null,
  height: number,
): Element {
  const vertical = canvas.aspect === "vertical";
  return titleBlock({
    aspect: canvas.aspect,
    title: input.deckName,
    maxChars: canvas.titleMaxChars,
    titleMaxWidth: vertical ? undefined : 560,
    ownerName: input.ownerName,
    meta: metaLabel,
    metaTrailing:
      domainIcons.length > 0 &&
      element(
        "div",
        { display: "flex", flexDirection: "row", alignItems: "center", marginLeft: 14, gap: 6 },
        ...domainIcons,
      ),
    extra:
      input.resultLine === undefined
        ? undefined
        : resultLineElement(input.resultLine, canvas, vertical ? 12 : 10),
    qrUri,
    height,
    typeHeight: titleTypeHeight(input, canvas),
  });
}

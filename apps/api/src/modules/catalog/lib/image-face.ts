import type { CardFace } from "@openrift/shared/types/enums";

import type { Repos } from "../../../deps.js";
import { assertFound } from "../../../lib/assertions.js";

export async function faceForNewImage(
  repos: Pick<Repos, "catalogMutations" | "printingImages">,
  printingId: string,
  by: { faceId: string } | { shortCode: string },
): Promise<CardFace> {
  if ("faceId" in by) {
    const side = await repos.catalogMutations.sideOfFace(printingId, by.faceId);
    assertFound(side, "That face is not on the printing");
    return side === 2 ? "back" : "front";
  }
  return repos.printingImages.faceForShortCode(printingId, by.shortCode);
}

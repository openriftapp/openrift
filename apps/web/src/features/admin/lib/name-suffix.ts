import { normalizeNameForIdentity } from "@openrift/shared/utils";

const TRIM_EDGES = /^[\s\-–—(:|/]+|[\s\-–—:|/]+$/gu;
const ORPHAN_CLOSER = /^(?<head>[^(]*)\)/u;

/** Empty when the two names are the same card name. */
export function nameBeyondCardName(otherName: string, cardName: string): string {
  if (cardName.length === 0) {
    return otherName;
  }
  if (normalizeNameForIdentity(otherName) === normalizeNameForIdentity(cardName)) {
    return "";
  }
  const rest = otherName.startsWith(cardName) ? otherName.slice(cardName.length) : otherName;
  // Slicing the card name off can take the "(" and leave its ")" stranded.
  return rest
    .replaceAll(TRIM_EDGES, "")
    .replace(ORPHAN_CLOSER, "$<head>")
    .replaceAll(TRIM_EDGES, "");
}

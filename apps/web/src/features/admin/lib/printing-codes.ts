export function shortCodeFromPublicCode(publicCode: unknown): string | null {
  if (typeof publicCode !== "string") {
    return null;
  }
  const [set, number] = publicCode.split("/")[0]?.split("-") ?? [];
  if (set === undefined || set.length === 0) {
    return null;
  }
  return number === undefined || number.length === 0 ? set : `${set}-${number}`;
}

export function setSlugFromShortCode(shortCode: unknown): string | null {
  if (typeof shortCode !== "string") {
    return null;
  }
  const prefix = shortCode.split("-")[0]?.trim() ?? "";
  return prefix.length > 0 ? prefix : null;
}

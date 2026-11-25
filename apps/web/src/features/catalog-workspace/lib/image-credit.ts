/** Admin uploads carry no credit; a printing-desk upload is credited to its uploader. */
export function uploadCredit({
  isAdmin,
  uploaderName,
}: {
  isAdmin: boolean;
  uploaderName: string | null | undefined;
}): string | undefined {
  if (isAdmin) {
    return undefined;
  }
  const name = uploaderName?.trim() ?? "";
  return name.length > 0 ? name : undefined;
}

export function creationFailureText(failed: readonly string[], reasons: readonly string[]): string {
  return `The printing was created, but ${failed.join(" and ")} did not save: ${reasons.join("; ")}.`;
}

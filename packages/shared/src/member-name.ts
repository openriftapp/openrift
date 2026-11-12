export function memberNameEnglish(name: string | null | undefined, closed?: boolean): string {
  if (closed) {
    return "Former member";
  }
  return name?.trim() || "Unnamed member";
}

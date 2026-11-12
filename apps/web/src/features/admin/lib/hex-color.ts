export function validateHexColor(color: string, example: string): string | null {
  const trimmed = color.trim();
  if (trimmed && !/^#[0-9a-fA-F]{6}$/u.test(trimmed)) {
    return `Color must be a hex code (e.g. ${example})`;
  }
  return null;
}

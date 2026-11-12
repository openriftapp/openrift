import { validateHexColor } from "@/features/admin/lib/hex-color";

export function validateKeywordColor(color: string): string | null {
  if (!color.trim()) {
    return "Pick a color to give this keyword a style";
  }
  return validateHexColor(color, "#6366f1");
}

import type { Theme } from "@openrift/shared/types/api/preferences";

import { m } from "@/paraglide/messages.js";

export function themeLabels(): Record<Theme, string> {
  return {
    auto: m.profile_display_theme_auto(),
    light: m.profile_display_theme_light(),
    dark: m.profile_display_theme_dark(),
  };
}

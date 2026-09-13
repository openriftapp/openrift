import { useEffect } from "react";

import { hasLocaleCookie, localeFromLanguageTags } from "@/lib/locale-entry";
import { getLocale, setLocale } from "@/paraglide/runtime.js";

/**
 * A cached page reaches a first-time visitor without the server seeing their
 * Accept-Language, so the browser language is adopted here, with one reload.
 */
export function useBrowserLocale(): void {
  useEffect(() => {
    if (hasLocaleCookie(document.cookie)) {
      return;
    }
    const preferred = localeFromLanguageTags(navigator.languages ?? []);
    if (preferred === undefined || preferred === getLocale()) {
      return;
    }
    void setLocale(preferred, { reload: false });
    // Blocked cookies would otherwise reload forever.
    if (hasLocaleCookie(document.cookie)) {
      globalThis.location.reload();
    }
  }, []);
}

import { useEffect } from "react";

import { hasLocaleCookie } from "@/lib/locale-entry";
import { extractLocaleFromNavigator, getLocale, setLocale } from "@/paraglide/runtime.js";

/**
 * A cached page reaches a first-time visitor without the server seeing their
 * Accept-Language, so the browser language is adopted here, with one reload.
 */
export function useBrowserLocale(): void {
  useEffect(() => {
    if (hasLocaleCookie(document.cookie)) {
      return;
    }
    const preferred = extractLocaleFromNavigator();
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

import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { useSiteSettingValue } from "@/hooks/use-site-settings";
import {
  firstTouchSource,
  flushQueuedEvents,
  parseSignupMethod,
  recordFirstTouch,
  routeTemplate,
  SOCIAL_SIGNUP_PARAM,
  trackSignupComplete,
} from "@/lib/analytics";

/** Injects the Umami analytics script when the `umami-url` and `umami-website-id` site settings are configured. */
export function Analytics() {
  const umamiUrl = useSiteSettingValue("umami-url");
  const umamiWebsiteId = useSiteSettingValue("umami-website-id");
  const router = useRouter();

  useEffect(() => {
    const matchRoutes = (pathname: string) => router.matchRoutes(pathname);
    recordFirstTouch({
      path: routeTemplate(globalThis.location.href, matchRoutes),
      source: firstTouchSource({
        search: globalThis.location.search,
        referrer: document.referrer,
        host: globalThis.location.host,
      }),
    });

    const url = new URL(globalThis.location.href);
    const method = parseSignupMethod(url.searchParams.get(SOCIAL_SIGNUP_PARAM));
    if (method) {
      trackSignupComplete(method, routeTemplate(url.pathname, matchRoutes));
      url.searchParams.delete(SOCIAL_SIGNUP_PARAM);
      router.history.replace(
        `${url.pathname}${url.search}${url.hash}`,
        router.history.location.state,
      );
    }
  }, [router]);

  useEffect(() => {
    if (!umamiUrl || !umamiWebsiteId) {
      return;
    }

    const script = document.createElement("script");
    script.defer = true;
    script.src = `${umamiUrl}/script.js`;
    script.dataset.websiteId = umamiWebsiteId;
    script.addEventListener("load", flushQueuedEvents);
    document.head.append(script);

    return () => {
      script.remove();
    };
  }, [umamiUrl, umamiWebsiteId]);

  return null;
}

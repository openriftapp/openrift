export type InstallGuide =
  | "ios-safari"
  | "ios-safari-legacy"
  | "ios-other"
  | "android-chrome"
  | "android-samsung"
  | "android-other"
  | "in-app"
  | "desktop";

export interface InstallPlatform {
  os: "ios" | "android" | "desktop";
  guide: InstallGuide;
  ipad: boolean;
  inAppName?: string;
}

const IN_APP_BROWSERS: [RegExp, string][] = [
  [/Instagram/u, "Instagram"],
  [/FBAN|FBAV|FB_IAB/u, "Facebook"],
  [/musical_ly|BytedanceWebview|TikTok/iu, "TikTok"],
  [/Snapchat/u, "Snapchat"],
  [/\bLine\//u, "LINE"],
  [/Discord/u, "Discord"],
  [/Reddit/u, "Reddit"],
  [/Twitter/u, "X"],
  [/\bGSA\//u, "Google"],
];

function inAppName(userAgent: string): string | undefined {
  return IN_APP_BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
}

export function detectInstallPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  // iPadOS reports a desktop Mac user agent; touch support gives it away.
  const ipad =
    userAgent.includes("iPad") || (userAgent.includes("Macintosh") && maxTouchPoints > 1);
  const ios = ipad || /iPhone|iPod/u.test(userAgent);
  const android = !ios && userAgent.includes("Android");

  if (!ios && !android) {
    return { os: "desktop", guide: "desktop", ipad: false };
  }

  const os = ios ? "ios" : "android";
  const app = inAppName(userAgent);
  const androidWebView = android && userAgent.includes("; wv)");
  if (app !== undefined || androidWebView) {
    return { os, guide: "in-app", ipad, inAppName: app };
  }

  if (ios) {
    if (/CriOS|FxiOS|EdgiOS|OPiOS/u.test(userAgent)) {
      return { os, guide: "ios-other", ipad };
    }
    const safariMajor = Number(/Version\/(?<major>\d+)/u.exec(userAgent)?.groups?.major ?? 0);
    return { os, guide: safariMajor >= 26 ? "ios-safari" : "ios-safari-legacy", ipad };
  }

  if (userAgent.includes("SamsungBrowser")) {
    return { os, guide: "android-samsung", ipad };
  }
  if (/Firefox|EdgA|OPR|YaBrowser|UCBrowser/u.test(userAgent) || !userAgent.includes("Chrome/")) {
    return { os, guide: "android-other", ipad };
  }
  return { os, guide: "android-chrome", ipad };
}

export function isStandaloneDisplay(): boolean {
  if (typeof globalThis.matchMedia !== "function") {
    return false;
  }
  const iosStandalone = (globalThis.navigator as { standalone?: boolean } | undefined)?.standalone;
  return iosStandalone === true || globalThis.matchMedia("(display-mode: standalone)").matches;
}

// `x-safari-` is undocumented and some Android apps block `intent:` links,
// so callers always offer a copy-link fallback next to this.
export function openInBrowserUrl(os: "ios" | "android", url: string): string {
  if (os === "ios") {
    return `x-safari-${url}`;
  }
  const parsed = new URL(url);
  return `intent://${parsed.host}${parsed.pathname}${parsed.search}#Intent;scheme=${parsed.protocol.replace(":", "")};end`;
}

const NUDGE_MIN_VISIT_DAYS = 3;

export function installNudgeVisible(opts: {
  os: InstallPlatform["os"];
  standalone: boolean;
  visitDays: number;
  dismissed: boolean;
  pathname: string;
}): boolean {
  return (
    opts.os !== "desktop" &&
    !opts.standalone &&
    !opts.dismissed &&
    opts.visitDays >= NUDGE_MIN_VISIT_DAYS &&
    opts.pathname !== "/install"
  );
}

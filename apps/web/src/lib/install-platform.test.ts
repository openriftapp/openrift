import { describe, expect, it } from "vitest";

import { detectInstallPlatform, installNudgeVisible, openInBrowserUrl } from "./install-platform";

const UA = {
  iphoneSafari26:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
  iphoneSafari18:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1",
  iphoneInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.0.0",
  ipadDesktopMode:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  androidSamsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:142.0) Gecko/142.0 Firefox/142.0",
  androidWebView:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36",
  androidFacebook:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
};

describe("detectInstallPlatform", () => {
  it("picks the Safari 26 guide from the Version token, ignoring the frozen OS version", () => {
    expect(detectInstallPlatform(UA.iphoneSafari26)).toEqual({
      os: "ios",
      guide: "ios-safari",
      ipad: false,
    });
  });

  it("picks the legacy Safari guide before version 26", () => {
    expect(detectInstallPlatform(UA.iphoneSafari18).guide).toBe("ios-safari-legacy");
  });

  it("treats Chrome on iOS as another iOS browser", () => {
    expect(detectInstallPlatform(UA.iphoneChrome).guide).toBe("ios-other");
  });

  it("names a known in-app browser", () => {
    expect(detectInstallPlatform(UA.iphoneInstagram)).toEqual({
      os: "ios",
      guide: "in-app",
      ipad: false,
      inAppName: "Instagram",
    });
    expect(detectInstallPlatform(UA.androidFacebook).inAppName).toBe("Facebook");
  });

  it("treats an unnamed Android WebView as an in-app browser", () => {
    expect(detectInstallPlatform(UA.androidWebView)).toEqual({
      os: "android",
      guide: "in-app",
      ipad: false,
      inAppName: undefined,
    });
  });

  it("recognises an iPad that reports a Mac user agent by its touch points", () => {
    expect(detectInstallPlatform(UA.ipadDesktopMode, 5)).toEqual({
      os: "ios",
      guide: "ios-safari",
      ipad: true,
    });
  });

  it("keeps a Mac without touch on the desktop guide", () => {
    expect(detectInstallPlatform(UA.macSafari, 0).guide).toBe("desktop");
  });

  it("splits Android browsers", () => {
    expect(detectInstallPlatform(UA.androidChrome).guide).toBe("android-chrome");
    expect(detectInstallPlatform(UA.androidSamsung).guide).toBe("android-samsung");
    expect(detectInstallPlatform(UA.androidFirefox).guide).toBe("android-other");
  });

  it("falls back to desktop for anything that is not a phone or tablet", () => {
    expect(detectInstallPlatform(UA.windowsChrome).guide).toBe("desktop");
    expect(detectInstallPlatform("").guide).toBe("desktop");
  });
});

describe("openInBrowserUrl", () => {
  it("prefixes the Safari scheme on iOS", () => {
    expect(openInBrowserUrl("ios", "https://example.test/install")).toBe(
      "x-safari-https://example.test/install",
    );
  });

  it("builds an Android intent link that keeps path and query", () => {
    expect(openInBrowserUrl("android", "https://example.test/install?from=menu")).toBe(
      "intent://example.test/install?from=menu#Intent;scheme=https;end",
    );
  });
});

describe("installNudgeVisible", () => {
  const base = {
    os: "ios" as const,
    standalone: false,
    visitDays: 3,
    dismissed: false,
    pathname: "/cards",
  };

  it("shows on a phone from the third visit day", () => {
    expect(installNudgeVisible(base)).toBe(true);
    expect(installNudgeVisible({ ...base, visitDays: 2 })).toBe(false);
  });

  it("stays hidden on desktop, once installed, after dismissal and on the install page", () => {
    expect(installNudgeVisible({ ...base, os: "desktop" })).toBe(false);
    expect(installNudgeVisible({ ...base, standalone: true })).toBe(false);
    expect(installNudgeVisible({ ...base, dismissed: true })).toBe(false);
    expect(installNudgeVisible({ ...base, pathname: "/install" })).toBe(false);
  });
});

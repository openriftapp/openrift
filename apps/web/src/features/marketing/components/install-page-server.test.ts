import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { detectInstallPlatform } from "@/lib/install-platform";

import { InstallPage } from "./install-page";

const IPHONE_SAFARI_26 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";

const IPHONE_INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.0.0";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";

function serverHtml(userAgent: string): string {
  return renderToString(
    createElement(InstallPage, { initialPlatform: detectInstallPlatform(userAgent) }),
  );
}

describe("InstallPage on the server", () => {
  it("renders the phone steps for a phone request", () => {
    expect(globalThis.window).toBeUndefined();

    const html = serverHtml(IPHONE_SAFARI_26);

    expect(html).toContain("Put OpenRift on your home screen");
    expect(html).toContain("iPhone · Safari");
  });

  it("renders the in-app and Android guides without browser globals", () => {
    expect(serverHtml(IPHONE_INSTAGRAM)).toContain("Open this page in Safari first");
    expect(serverHtml(ANDROID_CHROME)).toContain("Add to home screen");
  });

  it("renders the computer view for a desktop request without browser globals", () => {
    expect(serverHtml("")).toContain("Get OpenRift on your phone");
  });
});

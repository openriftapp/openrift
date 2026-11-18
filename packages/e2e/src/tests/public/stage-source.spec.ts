import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { WEB_BASE_URL } from "../../helpers/constants.js";

// An OBS browser source composites the page over the stream, so any opaque
// background on html or body covers the scene from the first frame on.

const SOURCE_URL = "/stage/source/e2e-transparent-source";
const TRANSPARENT = "rgba(0, 0, 0, 0)";

async function rootBackgrounds(page: Page) {
  return page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).backgroundColor,
    htmlImage: getComputedStyle(document.documentElement).backgroundImage,
    body: getComputedStyle(document.body).backgroundColor,
    bodyImage: getComputedStyle(document.body).backgroundImage,
  }));
}

function expectTransparent(backgrounds: Awaited<ReturnType<typeof rootBackgrounds>>) {
  expect(backgrounds).toEqual({
    html: TRANSPARENT,
    htmlImage: "none",
    body: TRANSPARENT,
    bodyImage: "none",
  });
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`stage source background (${theme} theme)`, () => {
    test.beforeEach(async ({ context }) => {
      await context.addCookies([
        {
          name: "theme",
          value: encodeURIComponent(JSON.stringify({ state: { preference: theme } })),
          url: WEB_BASE_URL,
        },
      ]);
    });

    test("the server HTML sets no background on html or body", async ({ page }) => {
      const response = await page.request.get(SOURCE_URL);
      expect(response.ok()).toBeTruthy();
      const html = await response.text();

      const htmlTag = /<html\b[^>]*>/u.exec(html)?.[0] ?? "";
      const bodyTag = /<body\b[^>]*>/u.exec(html)?.[0] ?? "";
      expect(htmlTag).toContain('data-chrome="transparent"');
      expect(htmlTag).not.toMatch(/\bstyle=/u);
      expect(bodyTag).not.toMatch(/\bstyle=/u);

      const inlineStyles = [...html.matchAll(/<style\b[^>]*>(?<css>[\s\S]*?)<\/style>/gu)].map(
        (match) => match.groups?.css ?? "",
      );
      for (const css of inlineStyles) {
        // A real background declaration, not a `--background` token on :root.
        expect(css).not.toMatch(
          /(?:^|[\s,}])(?:html|body|:root)\s*\{[^}]*(?<![-\w])background(?:-color|-image)?\s*:/u,
        );
      }
    });

    test("html and body are transparent before hydration", async ({ page }) => {
      // Blocking every script request leaves the server markup and its inline scripts
      // (the theme bootstrap) unhydrated: the state of the first paint.
      await page.route("**/*", async (route) => {
        await (route.request().resourceType() === "script" ? route.abort() : route.continue());
      });
      await page.goto(SOURCE_URL, { waitUntil: "load" });

      await expect(page.locator("html")).not.toHaveAttribute("data-hydrated");
      await expect(page.locator("html")).toHaveClass(
        theme === "dark" ? /\bdark\b/u : /^(?!.*\bdark\b)/u,
      );
      // The app stylesheet's chrome rule applies, so the check below runs against real styles.
      await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
      expectTransparent(await rootBackgrounds(page));
    });

    test("html and body stay transparent after hydration", async ({ page }) => {
      await page.goto(SOURCE_URL);
      await expect(page.locator("html")).toHaveAttribute("data-hydrated", "", { timeout: 20_000 });

      expectTransparent(await rootBackgrounds(page));
    });
  });
}

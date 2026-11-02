import { describe, expect, test } from "vitest";

import { botBlockedResponse, isBotBlockedPath, isKnownBot } from "./known-bot";

describe("isKnownBot", () => {
  test.each([
    "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; claudebot@anthropic.com)",
    "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)",
  ])("recognizes %s", (userAgent) => {
    expect(isKnownBot(userAgent)).toBe(true);
  });

  test.each([
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:159.0) Gecko/20100101 Firefox/159.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 13; CUBOT KINGKONG 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/150.0.0.0 Safari/537.36",
    "ExampleDeckApp-CardLibrary/1.1 (+https://example.com/)",
  ])("lets %s through", (userAgent) => {
    expect(isKnownBot(userAgent)).toBe(false);
  });

  test("treats a missing User-Agent as human", () => {
    expect(isKnownBot(null)).toBe(false);
    expect(isKnownBot(undefined)).toBe(false);
    expect(isKnownBot("")).toBe(false);
  });
});

describe("isBotBlockedPath", () => {
  test.each([
    "/login",
    "/signup",
    "/reset-password",
    "/verify-email",
    "/meta/submit",
    "/meta/summoner-skirmish-2026/submit",
    "/login/",
  ])("blocks %s", (pathname) => {
    expect(isBotBlockedPath(pathname)).toBe(true);
  });

  test.each([
    "/",
    "/cards",
    "/meta",
    "/meta/summoner-skirmish-2026",
    "/meta/submissions",
    "/loginx",
  ])("allows %s", (pathname) => {
    expect(isBotBlockedPath(pathname)).toBe(false);
  });
});

describe("botBlockedResponse", () => {
  const googlebot = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
  const firefox =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:159.0) Gecko/20100101 Firefox/159.0";

  function request(path: string, userAgent: string): Request {
    return new Request(`https://example.com${path}`, { headers: { "user-agent": userAgent } });
  }

  test("refuses a known bot on an auth page without caching or indexing the refusal", () => {
    const response = botBlockedResponse(request("/login?redirect=%2Fcards", googlebot));
    expect(response?.status).toBe(403);
    expect(response?.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response?.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  test("lets a browser through to an auth page", () => {
    expect(botBlockedResponse(request("/login", firefox))).toBeNull();
  });

  test("lets a known bot through to other pages", () => {
    expect(botBlockedResponse(request("/cards", googlebot))).toBeNull();
  });
});

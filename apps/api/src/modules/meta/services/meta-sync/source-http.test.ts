import { describe, expect, it } from "vitest";

import {
  isHtmlChallenge,
  isPermanentRefusal,
  isThrottle,
  SourceHttpError,
  SourceThrottledError,
} from "./source-http.js";

describe("isPermanentRefusal", () => {
  it.each([400, 401, 403, 404, 410])("refuses for good on %i", (status) => {
    expect(isPermanentRefusal(new SourceHttpError(status, "no"))).toBe(true);
  });

  it.each([408, 425, 429, 500, 503])("treats %i as asking again later", (status) => {
    expect(isPermanentRefusal(new SourceHttpError(status, "busy"))).toBe(false);
  });

  it("never reads a plain error as a refusal", () => {
    expect(isPermanentRefusal(new Error("HTTP 404"))).toBe(false);
  });
});

describe("isThrottle", () => {
  it("knows a throttle by its status", () => {
    expect(isThrottle(new SourceThrottledError("/a"))).toBe(true);
    expect(isThrottle(new SourceHttpError(503, "busy"))).toBe(false);
  });
});

describe("isHtmlChallenge", () => {
  it("reads an HTML page below 500 as a challenge, and a gateway's HTML 5xx as an outage", () => {
    expect(isHtmlChallenge(200, "  <html>verify</html>")).toBe(true);
    expect(isHtmlChallenge(502, "<html>Bad Gateway</html>")).toBe(false);
    expect(isHtmlChallenge(200, '{"code":0}')).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { sanitizeOperatorUrl } from "./operator-links";

describe("sanitizeOperatorUrl", () => {
  it("keeps an https URL", () => {
    expect(sanitizeOperatorUrl("https://example.com/impressum")).toBe(
      "https://example.com/impressum",
    );
  });

  it("keeps an http URL", () => {
    expect(sanitizeOperatorUrl("http://192.168.2.17:8080/privacy")).toBe(
      "http://192.168.2.17:8080/privacy",
    );
  });

  it("drops an unset value", () => {
    expect(sanitizeOperatorUrl(undefined)).toBeUndefined();
    expect(sanitizeOperatorUrl("")).toBeUndefined();
  });

  it("drops a javascript URL", () => {
    // oxlint-disable-next-line no-script-url -- the value under test
    expect(sanitizeOperatorUrl("javascript:alert(1)")).toBeUndefined();
  });

  it("drops a relative path", () => {
    expect(sanitizeOperatorUrl("/impressum")).toBeUndefined();
  });
});

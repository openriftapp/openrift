// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  claimDisplayLanguagesCookie,
  clearDisplayLanguagesCookie,
  DISPLAY_LANGUAGES_COOKIE,
  parseDisplayLanguages,
  releaseDisplayLanguagesCookie,
  viewerDisplayLanguages,
  writeDisplayLanguagesCookie,
} from "./display-languages-cookie";
import { readClientCookie } from "./shell-prefs";

const KNOWN = new Set(["EN", "DE", "FR", "SC"]);
const SESSION = "better-auth.session_token=abc";

function header(...parts: string[]): string {
  return parts.join("; ");
}

describe("parseDisplayLanguages", () => {
  it("keeps the stored order", () => {
    expect(parseDisplayLanguages("DE,EN,FR", KNOWN)).toEqual(["DE", "EN", "FR"]);
  });

  it("drops unknown and repeated codes", () => {
    expect(parseDisplayLanguages("DE,XX,DE,<b>,EN", KNOWN)).toEqual(["DE", "EN"]);
  });

  it("reads an empty value as no languages", () => {
    expect(parseDisplayLanguages("", KNOWN)).toBeNull();
  });

  it("rejects a value that names no known language", () => {
    expect(parseDisplayLanguages("XX,YY", KNOWN)).toBeNull();
  });

  it("rejects an oversized value", () => {
    expect(parseDisplayLanguages(Array.from({ length: 80 }, () => "DE").join(","), KNOWN)).toBe(
      null,
    );
  });

  it("caps the number of languages", () => {
    const many = new Set(Array.from({ length: 30 }, (_, index) => `L${index}`));
    const parsed = parseDisplayLanguages([...many].join(","), many);
    expect(parsed).toHaveLength(16);
  });

  it("reads a missing value as null", () => {
    expect(parseDisplayLanguages(undefined, KNOWN)).toBeNull();
  });
});

describe("viewerDisplayLanguages", () => {
  it("reads the languages of a signed-in viewer", () => {
    expect(
      viewerDisplayLanguages(header(SESSION, `${DISPLAY_LANGUAGES_COOKIE}=DE%2CEN`), KNOWN),
    ).toEqual(["DE", "EN"]);
  });

  it("reads a signed-in viewer without the cookie as no languages", () => {
    expect(viewerDisplayLanguages(header(SESSION, "theme=dark"), KNOWN)).toBeNull();
  });

  it("ignores a stale cookie on a request without a session", () => {
    expect(
      viewerDisplayLanguages(header("theme=dark", `${DISPLAY_LANGUAGES_COOKIE}=DE%2CEN`), KNOWN),
    ).toBeNull();
    expect(viewerDisplayLanguages(null, KNOWN)).toBeNull();
  });

  it("ignores a value that does not decode", () => {
    expect(viewerDisplayLanguages(header(SESSION, `${DISPLAY_LANGUAGES_COOKIE}=%E0`), KNOWN)).toBe(
      null,
    );
  });
});

describe("writeDisplayLanguagesCookie", () => {
  afterEach(() => {
    claimDisplayLanguagesCookie(null);
    clearDisplayLanguagesCookie();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("writes a value the reader returns unchanged", () => {
    writeDisplayLanguagesCookie("user-1", ["FR", "EN"]);
    expect(viewerDisplayLanguages(header(SESSION, document.cookie), KNOWN)).toEqual(["FR", "EN"]);
  });

  it("clears the cookie", () => {
    writeDisplayLanguagesCookie("user-1", ["FR"]);
    clearDisplayLanguagesCookie();
    expect(readClientCookie(DISPLAY_LANGUAGES_COOKIE) ?? "").toBe("");
  });

  it("drops a cookie another account wrote", () => {
    writeDisplayLanguagesCookie("user-1", ["FR"]);
    claimDisplayLanguagesCookie("user-2");
    expect(readClientCookie(DISPLAY_LANGUAGES_COOKIE) ?? "").toBe("");
  });

  it("keeps the account's own cookie", () => {
    writeDisplayLanguagesCookie("user-1", ["FR"]);
    claimDisplayLanguagesCookie("user-1");
    expect(readClientCookie(DISPLAY_LANGUAGES_COOKIE)).toBe("user-1|FR");
  });

  it("refuses writes after sign-out until the session is gone", () => {
    releaseDisplayLanguagesCookie();
    writeDisplayLanguagesCookie("user-1", ["EN"]);
    expect(readClientCookie(DISPLAY_LANGUAGES_COOKIE) ?? "").toBe("");

    claimDisplayLanguagesCookie(null);
    writeDisplayLanguagesCookie("user-1", ["EN"]);
    expect(readClientCookie(DISPLAY_LANGUAGES_COOKIE)).toBe("user-1|EN");
  });

  it("marks the cookie Secure over HTTPS only", () => {
    const written: string[] = [];
    vi.spyOn(document, "cookie", "set").mockImplementation((value: string) => {
      written.push(value);
    });
    writeDisplayLanguagesCookie("user-1", ["EN"]);
    vi.stubGlobal("location", { protocol: "https:" });
    writeDisplayLanguagesCookie("user-1", ["EN"]);
    expect(written[0]).not.toContain("Secure");
    expect(written[1]).toContain("; Secure");
  });
});

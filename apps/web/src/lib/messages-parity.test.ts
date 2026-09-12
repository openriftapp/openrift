// oxlint-disable-next-line import/no-nodejs-modules -- test reads the message files as text
import { readFileSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules -- test reads the message files as text
import path from "node:path";

import { describe, expect, it } from "vitest";

const locales = ["en", "de", "fr"] as const;
type Locale = (typeof locales)[number];

const messages = Object.fromEntries(
  locales.map((locale) => [
    locale,
    JSON.parse(
      readFileSync(path.resolve(__dirname, `../../messages/${locale}.json`), "utf-8"),
    ) as Record<string, string>,
  ]),
) as Record<Locale, Record<string, string>>;

const keysOf = (locale: Locale) => Object.keys(messages[locale]).filter((key) => key !== "$schema");

const placeholders = (value: string) =>
  [...value.matchAll(/\{(?<name>\w+)\}/gu)]
    .map((match) => match.groups?.name)
    .toSorted()
    .join(",");

describe("message files", () => {
  for (const locale of ["de", "fr"] as const) {
    it(`${locale} has the same keys as en`, () => {
      expect(keysOf(locale).toSorted()).toEqual(keysOf("en").toSorted());
    });

    it(`${locale} keeps every placeholder from en`, () => {
      const mismatched = keysOf("en")
        .filter(
          (key) =>
            placeholders(messages[locale][key] ?? "") !== placeholders(messages.en[key] ?? ""),
        )
        .map((key) => `${key}: ${messages.en[key]} -> ${messages[locale][key]}`);
      expect(mismatched).toEqual([]);
    });
  }

  for (const locale of locales) {
    it(`${locale} uses the ellipsis character and no em dashes`, () => {
      const offenders = keysOf(locale).filter((key) => {
        const value = messages[locale][key] ?? "";
        return (
          value.includes("...") || (value.includes("—") && key !== "contribute_text_em_dash_title")
        );
      });
      expect(offenders).toEqual([]);
    });
  }
});

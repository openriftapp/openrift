// oxlint-disable-next-line import/no-nodejs-modules -- test reads the message files as text
import { readFileSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules -- test reads the message files as text
import path from "node:path";

import { describe, expect, it } from "vitest";

const locales = ["en", "de", "fr"] as const;
type Locale = (typeof locales)[number];

interface Variant {
  declarations: string[];
  selectors: string[];
  match: Record<string, string>;
}
type Message = string | Variant[];

const messages = Object.fromEntries(
  locales.map((locale) => [
    locale,
    JSON.parse(
      readFileSync(path.resolve(__dirname, `../../messages/${locale}.json`), "utf-8"),
    ) as Record<string, Message>,
  ]),
) as Record<Locale, Record<string, Message>>;

const keysOf = (locale: Locale) => Object.keys(messages[locale]).filter((key) => key !== "$schema");

const textsOf = (message: Message | undefined): string[] => {
  if (message === undefined) {
    return [];
  }
  if (typeof message === "string") {
    return [message];
  }
  return message.flatMap((variant) => Object.values(variant.match));
};

const placeholders = (message: Message | undefined) =>
  [
    ...new Set(
      textsOf(message).flatMap((text) =>
        [...text.matchAll(/\{(?<name>\w+)\}/gu)].map((match) => match.groups?.name),
      ),
    ),
  ]
    .toSorted()
    .join(",");

const markupTags = (message: Message | undefined) =>
  [
    ...new Set(
      textsOf(message).flatMap((text) =>
        [...text.matchAll(/\{#(?<name>\w+)[ /}]/gu)].map((match) => match.groups?.name),
      ),
    ),
  ]
    .toSorted()
    .join(",");

const selectors = (message: Message | undefined) =>
  typeof message === "string" || message === undefined
    ? ""
    : message.map((variant) => variant.selectors.join(",")).join(";");

describe("message files", () => {
  for (const locale of ["de", "fr"] as const) {
    it(`${locale} has the same keys as en`, () => {
      expect(keysOf(locale).toSorted()).toEqual(keysOf("en").toSorted());
    });

    it(`${locale} keeps every placeholder from en`, () => {
      const mismatched = keysOf("en")
        .filter((key) => placeholders(messages[locale][key]) !== placeholders(messages.en[key]))
        .map((key) => `${key}: ${textsOf(messages.en[key])} -> ${textsOf(messages[locale][key])}`);
      expect(mismatched).toEqual([]);
    });

    it(`${locale} keeps every markup tag from en`, () => {
      const mismatched = keysOf("en")
        .filter((key) => markupTags(messages[locale][key]) !== markupTags(messages.en[key]))
        .map((key) => `${key}: ${textsOf(messages.en[key])} -> ${textsOf(messages[locale][key])}`);
      expect(mismatched).toEqual([]);
    });

    it(`${locale} selects variants on the same inputs as en`, () => {
      const mismatched = keysOf("en").filter(
        (key) => selectors(messages[locale][key]) !== selectors(messages.en[key]),
      );
      expect(mismatched).toEqual([]);
    });
  }

  for (const locale of locales) {
    it(`${locale} closes every markup tag`, () => {
      const offenders = keysOf(locale).filter((key) =>
        textsOf(messages[locale][key]).some((text) => {
          const opened = [...text.matchAll(/\{#(?<name>\w+)[^}]*(?<!\/)\}/gu)].map(
            (match) => match.groups?.name,
          );
          const closed = [...text.matchAll(/\{\/(?<name>\w+)\}/gu)].map(
            (match) => match.groups?.name,
          );
          return opened.toSorted().join(",") !== closed.toSorted().join(",");
        }),
      );
      expect(offenders).toEqual([]);
    });

    it(`${locale} ends every variant list with a catch-all`, () => {
      const offenders = keysOf(locale).filter((key) => {
        const message = messages[locale][key];
        if (typeof message !== "object") {
          return false;
        }
        return message.some((variant) =>
          Object.keys(variant.match)
            .at(-1)
            ?.split(",")
            .some((clause) => !clause.trim().endsWith("=*")),
        );
      });
      expect(offenders).toEqual([]);
    });

    it(`${locale} uses the ellipsis character and no em dashes`, () => {
      const offenders = keysOf(locale).filter((key) =>
        textsOf(messages[locale][key]).some(
          (value) =>
            value.includes("...") ||
            (value.includes("—") && key !== "contribute_text_em_dash_title"),
        ),
      );
      expect(offenders).toEqual([]);
    });
  }
});

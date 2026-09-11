// Catalogue language codes are not BCP 47: KR is a country code (Korean is
// `ko`) and SC is a script name. Add a row here when `languages` gains one.
const HTML_LANG_TAGS: Record<string, string> = {
  EN: "en",
  FR: "fr",
  KR: "ko",
  SC: "zh-Hans",
};

/**
 * BCP 47 tag for a catalogue language code, for the `lang` attribute on blocks
 * holding printed card text. Unmapped codes return undefined so the block
 * inherits the page language instead of claiming a wrong one, which would make
 * a screen reader mispronounce it with confidence.
 */
export function htmlLangTag(code: string | null | undefined): string | undefined {
  return code ? HTML_LANG_TAGS[code.toUpperCase()] : undefined;
}

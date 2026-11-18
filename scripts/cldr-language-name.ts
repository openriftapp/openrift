export interface CldrLanguageData {
  languages: Readonly<Record<string, string>>;
  scripts?: Readonly<Record<string, string>>;
  localePattern?: string;
}

/**
 * CLDR omits some language-script names (ko has no zh-Hans); those compose
 * from the language, the script and the locale pattern, as ICU does.
 */
export function cldrLanguageName(data: CldrLanguageData, tag: string): string | undefined {
  const direct = data.languages[tag];
  if (direct !== undefined) {
    return direct;
  }
  const [language = "", script = ""] = tag.split("-");
  const languagePart = data.languages[language];
  const scriptPart = data.scripts?.[script];
  if (languagePart === undefined || scriptPart === undefined || data.localePattern === undefined) {
    return undefined;
  }
  return data.localePattern.replace("{0}", languagePart).replace("{1}", scriptPart);
}

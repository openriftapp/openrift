const LEGACY_PREFIX = /(?<lead>^|\s)(?<prefix>id|ty|[ndktaf]):/gu;

const RENAMED: Record<string, string> = {
  n: "",
  d: "o",
  k: "kw",
  t: "otag",
  a: "a",
  f: "ft",
  ty: "t",
  id: "cn",
};

export function translateLegacyQuery(raw: string): string {
  return raw.replaceAll(LEGACY_PREFIX, (_match, lead: string, prefix: string) => {
    const renamed = RENAMED[prefix] ?? prefix;
    return renamed === "" ? lead : `${lead}${renamed}:`;
  });
}

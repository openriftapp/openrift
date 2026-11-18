const LEGACY_PREFIX = /(?<lead>^|[\s(]|(?<=^|[\s(])-)(?<prefix>id|ty|[ndktaf]):/giu;

const RENAMED: Record<string, string> = {
  n: "",
  d: "o",
  k: "kw",
  t: "tag",
  a: "a",
  f: "ft",
  ty: "t",
  id: "cn",
};

export function translateLegacyQuery(raw: string): string {
  return raw.replaceAll(LEGACY_PREFIX, (_match, lead: string, prefix: string) => {
    const key = prefix.toLowerCase();
    const renamed = RENAMED[key] ?? key;
    return renamed === "" ? lead : `${lead}${renamed}:`;
  });
}

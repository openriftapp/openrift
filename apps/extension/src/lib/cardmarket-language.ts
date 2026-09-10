// Cardmarket labels the language flag in the interface language (English,
// German, French, Spanish, Italian), so the match is on a stem, not a string.
const STEMS: [number, string[]][] = [
  [1, ["engl", "angl", "ingl"]],
  [2, ["fren", "fran"]],
  [3, ["germ", "deut", "allem", "alem", "tedes"]],
  [4, ["span", "espa", "spag"]],
  [5, ["ital"]],
  [7, ["jap", "giap"]],
  [8, ["port"]],
  [9, ["russ", "ruso"]],
  [10, ["kore", "core"]],
];

const CHINESE = ["chin", "cines"];
const TRADITIONAL = ["t-", "trad"];

function normalize(label: string): string {
  return label.normalize("NFD").replaceAll(/\p{M}/gu, "").trim().toLowerCase();
}

/** Cardmarket's numeric language id for a flag label, undefined for anything it cannot place. */
export function cardmarketLanguageId(label: string): number | undefined {
  const text = normalize(label);
  if (text.length === 0) {
    return undefined;
  }
  for (const [id, stems] of STEMS) {
    if (stems.some((stem) => text.startsWith(stem))) {
      return id;
    }
  }
  if (CHINESE.some((stem) => text.includes(stem))) {
    return TRADITIONAL.some((marker) => text.includes(marker)) ? 11 : 6;
  }
  return undefined;
}

type DiffType = "equal" | "added" | "removed";

export interface DiffSegment {
  text: string;
  type: DiffType;
}

interface LcsEntry<T> {
  type: DiffType;
  item: T;
}

type DiffGranularity = "word" | "char";

const WORD_TOKENS = /\w+|\s+|[^\w\s]+/gu;

function tokenize(text: string, granularity: DiffGranularity): string[] {
  if (granularity === "char") {
    return [...text];
  }
  return text.match(WORD_TOKENS) ?? [];
}

function merge(segments: DiffSegment[]): DiffSegment[] {
  const out: DiffSegment[] = [];
  for (const seg of segments) {
    const last = out.at(-1);
    if (last && last.type === seg.type) {
      last.text += seg.text;
    } else {
      out.push({ ...seg });
    }
  }
  return out;
}

function lcsCell(dp: number[][], row: number, column: number): number {
  const value = dp[row]?.[column];
  if (value === undefined) {
    throw new Error(`lcsDiff: no LCS cell at ${row},${column}`);
  }
  return value;
}

/**
 * Longest-common-subsequence diff of two sequences, comparing items by `key`.
 * Ties resolve so a replacement reads as the removal, then the addition.
 */
export function lcsDiff<T>(
  before: readonly T[],
  after: readonly T[],
  key: (item: T) => string,
): LcsEntry<T>[] {
  const beforeKeys = before.map((item) => key(item));
  const afterKeys = after.map((item) => key(item));

  const dp: number[][] = [Array.from({ length: after.length + 1 }, () => 0)];
  for (const [beforeIndex, beforeKey] of beforeKeys.entries()) {
    const row: number[] = [0];
    let left = 0;
    for (const [afterIndex, afterKey] of afterKeys.entries()) {
      const value =
        beforeKey === afterKey
          ? lcsCell(dp, beforeIndex, afterIndex) + 1
          : Math.max(lcsCell(dp, beforeIndex, afterIndex + 1), left);
      row.push(value);
      left = value;
    }
    dp.push(row);
  }

  const reversed: LcsEntry<T>[] = [];
  let i = before.length;
  let j = after.length;
  while (i > 0 || j > 0) {
    const beforeItem = before[i - 1];
    const afterItem = after[j - 1];
    if (
      beforeItem !== undefined &&
      afterItem !== undefined &&
      beforeKeys[i - 1] === afterKeys[j - 1]
    ) {
      reversed.push({ type: "equal", item: afterItem });
      i--;
      j--;
    } else if (
      afterItem !== undefined &&
      (beforeItem === undefined || lcsCell(dp, i, j - 1) >= lcsCell(dp, i - 1, j))
    ) {
      reversed.push({ type: "added", item: afterItem });
      j--;
    } else if (beforeItem === undefined) {
      throw new Error("lcsDiff: LCS backtrack ran past both sequences");
    } else {
      reversed.push({ type: "removed", item: beforeItem });
      i--;
    }
  }
  return reversed.toReversed();
}

export function textDiff(
  oldText: string,
  newText: string,
  options: { granularity?: DiffGranularity } = {},
): DiffSegment[] {
  if (oldText === newText) {
    return [{ text: oldText, type: "equal" }];
  }
  if (!oldText) {
    return [{ text: newText, type: "added" }];
  }
  if (!newText) {
    return [{ text: oldText, type: "removed" }];
  }

  const granularity = options.granularity ?? "word";
  const entries = lcsDiff(
    tokenize(oldText, granularity),
    tokenize(newText, granularity),
    (token) => token,
  );
  return merge(entries.map(({ type, item }) => ({ text: item, type })));
}

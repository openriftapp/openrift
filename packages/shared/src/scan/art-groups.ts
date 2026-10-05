/**
 * Several sets reuse one render (basic runes, tokens): the bank cannot tell
 * them apart, so their artworks are merged into one group.
 */
import type { AlignedSignature } from "./aligned-verify";
import { alignedScore } from "./aligned-verify";
import type { EmbedBank } from "./embed";
import { bankEmbedDim } from "./embed";

export interface ArtGroups {
  artKeys: Map<string, string>;
  groupOf: Map<string, string>;
}

function createUnionFind() {
  const parent = new Map<string, string>();
  const find = (artKey: string): string => {
    let root = artKey;
    while (parent.get(root) !== undefined && parent.get(root) !== root) {
      root = parent.get(root) as string;
    }
    parent.set(artKey, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      if (rootA < rootB) {
        parent.set(rootB, rootA);
      } else {
        parent.set(rootA, rootB);
      }
    }
  };
  return { find, union };
}

export function illustrationCardKey(name: string, type?: string): string {
  return `${name}|${type ?? ""}`;
}

type CardIdentityOf = (key: string) => { name: string; type?: string } | undefined;

/** Only the 256-d custom encoder is calibrated for same-render merging. */
function sameRenderDistance(dim: number): number {
  return dim === 256 ? 0.05 : 0;
}

function mergeSameRenderArtworks(
  bank: EmbedBank,
  artKeys: ReadonlyMap<string, string>,
  identityOf: CardIdentityOf,
): Map<string, string> {
  const { find, union } = createUnionFind();

  const dim = bankEmbedDim(bank);
  const maxDistance = sameRenderDistance(dim);
  if (maxDistance > 0) {
    const byCard = new Map<string, number[]>();
    for (const [index, key] of bank.keys.entries()) {
      const identity = identityOf(key);
      if (identity && artKeys.has(key)) {
        const card = illustrationCardKey(identity.name, identity.type);
        const list = byCard.get(card);
        if (list) {
          list.push(index);
        } else {
          byCard.set(card, [index]);
        }
      }
    }
    for (const indexes of byCard.values()) {
      for (let i = 0; i < indexes.length; i++) {
        for (let j = i + 1; j < indexes.length; j++) {
          const a = indexes[i] as number;
          const b = indexes[j] as number;
          const artA = artKeys.get(bank.keys[a] as string) as string;
          const artB = artKeys.get(bank.keys[b] as string) as string;
          if (artA === artB || find(artA) === find(artB)) {
            continue;
          }
          let dot = 0;
          for (let d = 0; d < dim; d++) {
            dot += (bank.vectors[a * dim + d] ?? 0) * (bank.vectors[b * dim + d] ?? 0);
          }
          if (1 - dot < maxDistance) {
            union(artA, artB);
          }
        }
      }
    }
  }

  return new Map([...artKeys].map(([key, artKey]) => [key, find(artKey)]));
}

/**
 * Each bank key's final artwork group: shared illustrations first, then
 * same-card renders whose embeddings nearly coincide.
 */
export function groupArtworks(
  bank: EmbedBank,
  artKeys: ReadonlyMap<string, string>,
  identityOf: CardIdentityOf,
  illustrationGroups: ReadonlyMap<string, string>,
): ArtGroups {
  const illustrated = new Map(
    [...artKeys].map(([key, artKey]) => [key, illustrationGroups.get(artKey) ?? artKey]),
  );
  const merged = mergeSameRenderArtworks(bank, illustrated, identityOf);
  const groupOf = new Map<string, string>();
  for (const [key, artKey] of artKeys) {
    groupOf.set(artKey, merged.get(key) ?? artKey);
  }
  return { artKeys: merged, groupOf };
}

export const SHARED_ILLUSTRATION_MIN_SCORE = 0.85;

export interface IllustrationSample {
  artKey: string;
  card: string;
  signature: AlignedSignature;
}

export function illustrationScore(a: AlignedSignature, b: AlignedSignature): number {
  return Math.min(alignedScore(a, b), alignedScore(b, a));
}

/**
 * Artworks of one card that show the same illustration in different renders
 * (a reprint with new crop or colour grading).
 */
export function groupSharedIllustrations(
  samples: readonly IllustrationSample[],
  minScore = SHARED_ILLUSTRATION_MIN_SCORE,
): Map<string, string> {
  const { find, union } = createUnionFind();
  for (const cardSamples of Map.groupBy(samples, (sample) => sample.card).values()) {
    for (let i = 0; i < cardSamples.length; i++) {
      for (let j = i + 1; j < cardSamples.length; j++) {
        const a = cardSamples[i] as IllustrationSample;
        const b = cardSamples[j] as IllustrationSample;
        if (a.artKey === b.artKey) {
          continue;
        }
        if (illustrationScore(a.signature, b.signature) >= minScore) {
          union(a.artKey, b.artKey);
        }
      }
    }
  }
  return new Map(samples.map((sample) => [sample.artKey, find(sample.artKey)]));
}

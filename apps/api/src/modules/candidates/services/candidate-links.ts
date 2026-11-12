/**
 * The single implementation of "which live card and printing does this
 * candidate row point at?". Used by the batch provider ingest, the in-app
 * user-submission ingest, the relink pass, and the meta archive's promotion
 * and overlay ingest; the key and gate must not be duplicated elsewhere.
 */
import { normalizeNameForIdentity } from "@openrift/shared/card-name";
import { resolveFinish } from "@openrift/shared/printing-accept";

import { buildPrintingLinkKey, buildSizedPrintingLinkKey } from "../../../lib/printing-link-key.js";
import { candidateAcceptKey } from "../lib/candidate-printing-accept.js";
import type { ingestRepo } from "../repositories/ingest.js";

/** The live-catalog lookups that resolve a card *name* to a card id. */
export interface CardNameIndex {
  /** Normalized card name to live card id. */
  cardIdByNorm: Map<string, string>;
  /** Normalized alias to live card id, consulted after {@link cardIdByNorm}. */
  cardIdByAliasNorm: Map<string, string>;
}

/** Live catalog lookups the candidate link resolution reads. */
export interface CandidateLinkIndex extends CardNameIndex {
  printingIdByKey: Map<string, string>;
  printingIdBySizedKey: Map<string, string>;
  /**
   * `"<provider>:<externalId>:<finish>"` to the manually pinned live printing id.
   */
  printingIdByOverrideKey: Map<string, string>;
}

interface CardNameSources {
  cardNorms: readonly { id: string; normName: string }[];
  aliases: readonly { cardId: string; normName: string }[];
}

interface CandidateLinkSources extends CardNameSources {
  printings: readonly {
    id: string;
    cardId: string;
    shortCode: string;
    finish: string;
    markerSlugs: string[];
    language: string;
    size: string;
  }[];
  linkOverrides: readonly {
    externalId: string;
    finish: string;
    provider: string;
    printingId: string;
  }[];
}

export type CardNameRepo = Pick<
  ReturnType<typeof ingestRepo>,
  "allCardNorms" | "allCardNameAliases"
>;

export type CandidateLinkRepo = CardNameRepo &
  Pick<ReturnType<typeof ingestRepo>, "allPrintingKeys" | "allPrintingLinkOverrides">;

function buildCardNameIndex(sources: CardNameSources): CardNameIndex {
  return {
    cardIdByNorm: new Map(sources.cardNorms.map((c) => [c.normName, c.id])),
    cardIdByAliasNorm: new Map(sources.aliases.map((a) => [a.normName, a.cardId])),
  };
}

function cardScoped(cardId: string, key: string): string {
  return `${cardId}|${key}`;
}

/** A side shared by several printings leaves its key unlinked: the candidate could be any of them. */
function printingIdsByUniqueKey(
  printings: CandidateLinkSources["printings"],
  keyOf: (printing: CandidateLinkSources["printings"][number]) => string,
): Map<string, string> {
  const idsByKey = Map.groupBy(printings, keyOf);
  const unique = new Map<string, string>();
  for (const [key, matches] of idsByKey) {
    const [first, ...rest] = new Set(matches.map((printing) => printing.id));
    if (first !== undefined && rest.length === 0) {
      unique.set(key, first);
    }
  }
  return unique;
}

function sidesUnderEveryCard(
  printings: CandidateLinkSources["printings"],
): CandidateLinkSources["printings"] {
  return [...Map.groupBy(printings, (side) => side.id).values()].flatMap((sides) =>
    [...new Set(sides.map((side) => side.cardId))].flatMap((cardId) =>
      sides.map((side) => ({ ...side, cardId })),
    ),
  );
}

export function buildCandidateLinkIndex(sources: CandidateLinkSources): CandidateLinkIndex {
  const sides = sidesUnderEveryCard(sources.printings);
  return {
    ...buildCardNameIndex(sources),
    printingIdByKey: printingIdsByUniqueKey(sides, (p) =>
      cardScoped(p.cardId, buildPrintingLinkKey(p)),
    ),
    printingIdBySizedKey: printingIdsByUniqueKey(sides, (p) =>
      cardScoped(p.cardId, buildSizedPrintingLinkKey(p)),
    ),
    printingIdByOverrideKey: new Map(
      sources.linkOverrides.map((r) => [`${r.provider}:${r.externalId}:${r.finish}`, r.printingId]),
    ),
  };
}

export async function loadCardNameIndex(repo: CardNameRepo): Promise<CardNameIndex> {
  const [cardNorms, aliases] = await Promise.all([repo.allCardNorms(), repo.allCardNameAliases()]);
  return buildCardNameIndex({ cardNorms, aliases });
}

export async function loadCandidateLinkIndex(repo: CandidateLinkRepo): Promise<CandidateLinkIndex> {
  const [cardNorms, aliases, printings, linkOverrides] = await Promise.all([
    repo.allCardNorms(),
    repo.allCardNameAliases(),
    repo.allPrintingKeys(),
    repo.allPrintingLinkOverrides(),
  ]);
  return buildCandidateLinkIndex({ cardNorms, aliases, printings, linkOverrides });
}

export function resolveCardIdByName(index: CardNameIndex, name: string): string | null {
  // An empty key means the name held no letters or digits at all, so it
  // identifies nothing — resolving on it would link this candidate to whichever
  // unrelated card normalized the same way.
  const normName = normalizeNameForIdentity(name);
  if (normName === "") {
    return null;
  }
  return index.cardIdByNorm.get(normName) ?? index.cardIdByAliasNorm.get(normName) ?? null;
}

export function resolvePrintingLink(
  index: CandidateLinkIndex,
  candidate: {
    /** The candidate card's source provider, scoping which pins apply. */
    provider: string;
    externalId: string;
    shortCode: string;
    finish: string | null;
    rarity: string | null;
    markerSlugs: readonly string[];
    language: string | null;
    size?: string | null;
    cardId: string | null;
    /** Trusted as-is: the caller must verify it belongs to the linked card. */
    claimedPrintingId?: string | null;
  },
): string | null {
  const override = index.printingIdByOverrideKey.get(
    `${candidate.provider}:${candidate.externalId}:${candidate.finish ?? ""}`,
  );
  if (override) {
    return override;
  }
  if (candidate.claimedPrintingId) {
    return candidate.claimedPrintingId;
  }
  const finish = resolveFinish(candidate.finish, candidate.rarity);
  if (candidate.cardId === null || !finish) {
    return null;
  }
  const identity = {
    shortCode: candidate.shortCode,
    finish,
    markerSlugs: candidate.markerSlugs,
    language: candidate.language,
    size: candidate.size ?? null,
  };
  const sized = index.printingIdBySizedKey.get(
    cardScoped(candidate.cardId, buildSizedPrintingLinkKey(identity)),
  );
  if (sized !== undefined || identity.size !== null) {
    return sized ?? null;
  }
  return (
    index.printingIdByKey.get(cardScoped(candidate.cardId, buildPrintingLinkKey(identity))) ?? null
  );
}

export function isPinnedLink(
  index: CandidateLinkIndex,
  candidate: { provider: string; externalId: string; finish: string | null },
): boolean {
  return index.printingIdByOverrideKey.has(
    `${candidate.provider}:${candidate.externalId}:${candidate.finish ?? ""}`,
  );
}

export type LinkIdentity = Parameters<typeof candidateAcceptKey>[0];

export function linkIdentityChanged(before: LinkIdentity, after: LinkIdentity): boolean {
  return candidateAcceptKey(before) !== candidateAcceptKey(after);
}

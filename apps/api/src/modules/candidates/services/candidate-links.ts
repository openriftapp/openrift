/**
 * The single implementation of "which live card and printing does this
 * candidate row point at?". Used by the batch provider ingest, the in-app
 * user-submission ingest, the relink pass, and the meta archive's promotion
 * and overlay ingest; the key and gate must not be duplicated elsewhere.
 */
import { normalizeNameForIdentity } from "@openrift/shared/card-name";
import { WellKnown } from "@openrift/shared/well-known";

import { buildPrintingLinkKey } from "../../../lib/printing-link-key.js";
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
  /** {@link buildPrintingLinkKey} output to live printing id. */
  printingIdByKey: Map<string, string>;
  /** The same key plus `|<size>`, for a side shared by a standard and an oversized printing. */
  printingIdBySizedKey: Map<string, string>;
  /**
   * `"<provider>:<externalId>:<finish>"` to the manually pinned live printing
   * id. Provider '' is the wildcard for rows that predate provider scoping;
   * resolution consults the candidate's own provider first, the wildcard
   * second, so two providers reusing the same external id can't hijack each
   * other's pins.
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

export function buildCandidateLinkIndex(sources: CandidateLinkSources): CandidateLinkIndex {
  return {
    ...buildCardNameIndex(sources),
    printingIdByKey: printingIdsByUniqueKey(sources.printings, (p) => buildPrintingLinkKey(p)),
    printingIdBySizedKey: printingIdsByUniqueKey(
      sources.printings,
      (p) => `${buildPrintingLinkKey(p)}|${p.size}`,
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

/**
 * Resolve a candidate printing to a live printing: a manual link override
 * first (it survives delete + re-upload), then the composite key.
 *
 * Rarity is deliberately not part of the gate: it isn't part of the key, and
 * requiring it left sources that report a finish but no rarity permanently
 * unlinked.
 */
export function resolvePrintingLink(
  index: CandidateLinkIndex,
  candidate: {
    /** The candidate card's source provider, scoping which pins apply. */
    provider: string;
    externalId: string;
    shortCode: string;
    finish: string | null;
    markerSlugs: readonly string[];
    language: string | null;
    size?: string | null;
    /** Whether the owning candidate card resolved to a live card. */
    cardLinked: boolean;
    /** Trusted as-is: the caller must verify it belongs to the linked card. */
    claimedPrintingId?: string | null;
  },
): string | null {
  const override =
    index.printingIdByOverrideKey.get(
      `${candidate.provider}:${candidate.externalId}:${candidate.finish ?? ""}`,
    ) ?? index.printingIdByOverrideKey.get(`:${candidate.externalId}:${candidate.finish ?? ""}`);
  if (override) {
    return override;
  }
  if (candidate.claimedPrintingId) {
    return candidate.claimedPrintingId;
  }
  if (!candidate.cardLinked || !candidate.finish) {
    return null;
  }
  const key = buildPrintingLinkKey({
    shortCode: candidate.shortCode,
    finish: candidate.finish,
    markerSlugs: candidate.markerSlugs,
    language: candidate.language,
  });
  const size = candidate.size ?? WellKnown.cardSize.STANDARD;
  return index.printingIdBySizedKey.get(`${key}|${size}`) ?? index.printingIdByKey.get(key) ?? null;
}

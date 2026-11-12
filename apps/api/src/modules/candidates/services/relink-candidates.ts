import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";

import type { candidateCardsRepo } from "../repositories/candidate-cards.js";
import type { ingestRepo } from "../repositories/ingest.js";
import type { LinkIdentity } from "./candidate-links.js";
import {
  isPinnedLink,
  linkIdentityChanged,
  loadCandidateLinkIndex,
  resolveCardIdByName,
  resolvePrintingLink,
} from "./candidate-links.js";

type IngestRepo = ReturnType<typeof ingestRepo>;
type CandidateCardsRepo = ReturnType<typeof candidateCardsRepo>;

/**
 * Ingest only links candidates at upload time, so a printing accepted after a
 * provider's last upload leaves matching candidates unlinked until re-upload.
 */
export async function relinkCandidatePrintings(repos: {
  ingest: IngestRepo;
  candidateCards: CandidateCardsRepo;
}): Promise<{ examined: number; linked: number }> {
  const [unlinked, linkIndex] = await Promise.all([
    repos.ingest.allUnlinkedCandidatePrintings(),
    loadCandidateLinkIndex(repos.ingest),
  ]);

  const idsByPrinting = new Map<string, string[]>();
  for (const cp of unlinked) {
    const resolvedId = resolvePrintingLink(linkIndex, {
      provider: cp.provider,
      externalId: cp.externalId,
      shortCode: cp.shortCode,
      finish: cp.finish,
      rarity: cp.rarity,
      markerSlugs: cp.markerSlugs,
      language: cp.language,
      size: cp.size,
      cardId: resolveCardIdByName(linkIndex, cp.cardName),
    });

    if (resolvedId) {
      const ids = idsByPrinting.get(resolvedId);
      if (ids) {
        ids.push(cp.id);
      } else {
        idsByPrinting.set(resolvedId, [cp.id]);
      }
    }
  }

  let linked = 0;
  for (const [printingId, ids] of idsByPrinting) {
    await repos.candidateCards.linkCandidatePrintings(ids, printingId);
    linked += ids.length;
  }

  return { examined: unlinked.length, linked };
}

/**
 * A claimed printing is stored as a plain link, so a contributor's row is never
 * re-resolved here: the claim would be lost.
 */
export async function reresolveEditedCandidateLink(
  repos: { ingest: IngestRepo; candidateCards: CandidateCardsRepo },
  candidatePrintingId: string,
  before: LinkIdentity,
): Promise<void> {
  const row = await repos.ingest.candidatePrintingForRelink(candidatePrintingId);
  if (!row) {
    return;
  }
  const finishChanged = (before.finish ?? "") !== (row.finish ?? "");
  const identityChanged = linkIdentityChanged(before, row);
  if (!finishChanged && !identityChanged) {
    return;
  }
  const linkIndex = await loadCandidateLinkIndex(repos.ingest);
  if (isPinnedLink(linkIndex, { ...row, finish: before.finish })) {
    if (finishChanged) {
      await repos.ingest.movePrintingLinkPin({
        provider: row.provider,
        externalId: row.externalId,
        fromFinish: before.finish,
        toFinish: row.finish,
      });
    }
    return;
  }
  if (!row.printingId || row.provider === USER_SUBMISSION_PROVIDER || !identityChanged) {
    return;
  }
  const resolvedId = resolvePrintingLink(linkIndex, {
    ...row,
    cardId: resolveCardIdByName(linkIndex, row.cardName),
  });
  if (resolvedId !== row.printingId) {
    await repos.candidateCards.linkCandidatePrintings([row.id], resolvedId);
  }
}

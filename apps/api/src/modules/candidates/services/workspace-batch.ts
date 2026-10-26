import type {
  WorkspaceAcceptTrustedCardsResponse,
  WorkspaceAcceptTrustedPrintingsResponse,
  WorkspaceAssignSuggestedListingsInput,
  WorkspaceAssignSuggestedListingsResponse,
  WorkspaceSuggestedListing,
  WorkspaceSuggestedListingsPreview,
  WorkspaceTrustedCardsPreview,
  WorkspaceTrustedPrintingsPreview,
} from "@openrift/shared/contracts/admin/catalog-workspace-batch";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import { productSuggestionKey } from "@openrift/shared/marketplace-suggestions";

import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import type { Io } from "../../../io.js";
import type { AdminAccess } from "../../../middleware/require-admin.js";
import { acceptPrinting } from "../../catalog/services/printing-admin.js";
import type { MarketplaceConfigs } from "../../marketplace/lib/marketplace-configs.js";
import type { UnassignedListings } from "../../marketplace/lib/unassigned-listings.js";
import { saveMappings } from "../../marketplace/services/marketplace-mapping.js";
import { recordAdminEvent } from "../../system/services/record-admin-event.js";
import {
  acceptPrintingFieldsFrom,
  eligibleTrustedCards,
  findDuplicatePrinting,
  missingPrintingFields,
  trustedPrintingGroups,
} from "../lib/workspace-batch.js";
import type { TrustedCardDraft, TrustedPrintingGroup } from "../lib/workspace-batch.js";
import { acceptFavoriteNewCard } from "./accept-gallery.js";
import { relinkCandidatePrintings } from "./relink-candidates.js";

type BatchRepos = Pick<
  Repos,
  | "workspaceBatch"
  | "candidateCards"
  | "providerSettings"
  | "catalogMutations"
  | "printingImages"
  | "markers"
  | "distributionChannels"
  | "printingEvents"
  | "catalog"
  | "adminEvents"
  | "ingest"
>;

interface MutationContext {
  access: AdminAccess | null;
  userId: string;
  transact: Transact;
  io: Io;
}

function assertAdmin(access: AdminAccess | null): void {
  if (access?.isAdmin !== true) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, "Forbidden");
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadTrustedCards(repos: BatchRepos): Promise<TrustedCardDraft[]> {
  const providers = [...(await repos.providerSettings.favoriteProviders())];
  const [drafts, liveCards] = await Promise.all([
    repos.workspaceBatch.trustedNewCardDrafts(providers),
    repos.candidateCards.listCardsForSourceList(),
  ]);
  const printings = await repos.candidateCards.allCandidatePrintingsForCandidateCards(
    drafts.map((draft) => draft.id),
  );
  return eligibleTrustedCards(drafts, printings, liveCards);
}

export async function previewTrustedCards(
  repos: BatchRepos,
  access: AdminAccess | null,
): Promise<WorkspaceTrustedCardsPreview> {
  assertAdmin(access);
  const drafts = await loadTrustedCards(repos);
  return { count: drafts.length, names: drafts.map((draft) => draft.name) };
}

export async function acceptTrustedCards(
  repos: BatchRepos,
  context: MutationContext,
): Promise<WorkspaceAcceptTrustedCardsResponse> {
  assertAdmin(context.access);
  const drafts = await loadTrustedCards(repos);
  const favoriteProviders = await repos.providerSettings.favoriteProviders();
  let accepted = 0;
  const skipped: WorkspaceAcceptTrustedCardsResponse["skipped"] = [];

  for (const draft of drafts) {
    try {
      const result = await acceptFavoriteNewCard(
        context.transact,
        context.io,
        repos,
        draft.normName,
        favoriteProviders,
      );
      accepted++;
      await recordAdminEvent(repos, context.userId, {
        action: "card.accept-favorites",
        entityType: "card",
        entityId: result.cardSlug,
        entityLabel: draft.normName,
        cardSlug: result.cardSlug,
        newValues: {
          cardSlug: result.cardSlug,
          printingsCreated: result.printingsCreated,
          skipped: result.skipped,
        },
      });
    } catch (error) {
      skipped.push({ name: draft.name, reason: errorMessage(error) });
    }
  }

  if (accepted > 0) {
    await repos.catalog.refreshCatalogViews();
  }
  return { accepted, skipped };
}

async function loadTrustedPrintings(repos: BatchRepos): Promise<{
  eligible: TrustedPrintingGroup[];
  ineligible: { label: string; reason: string }[];
}> {
  const providers = [...(await repos.providerSettings.favoriteProviders())];
  const rows = await repos.workspaceBatch.trustedNewPrintings(providers);
  const [printings, probes] = await Promise.all([
    repos.candidateCards.allCandidatePrintingsForCandidateCards([
      ...new Set(rows.map((row) => row.candidateCardId)),
    ]),
    repos.workspaceBatch.frontPrintingProbes([...new Set(rows.map((row) => row.cardId))]),
  ]);
  const eligible: TrustedPrintingGroup[] = [];
  const ineligible: { label: string; reason: string }[] = [];
  for (const group of trustedPrintingGroups(rows, printings)) {
    const label = `${group.cardSlug} ${group.label}`;
    const missing = missingPrintingFields(group.first);
    if (missing.length > 0) {
      ineligible.push({ label, reason: `missing: ${missing.join(", ")}` });
      continue;
    }
    const duplicate = findDuplicatePrinting(group, probes);
    if (duplicate) {
      ineligible.push({ label, reason: `possible duplicate of ${duplicate.shortCode}` });
      continue;
    }
    eligible.push(group);
  }
  return { eligible, ineligible };
}

export async function previewTrustedPrintings(
  repos: BatchRepos,
  access: AdminAccess | null,
): Promise<WorkspaceTrustedPrintingsPreview> {
  assertAdmin(access);
  const { eligible } = await loadTrustedPrintings(repos);
  return {
    count: eligible.length,
    items: eligible.map((group) => ({
      candidatePrintingId: group.first.id,
      cardSlug: group.cardSlug,
      label: group.label,
    })),
  };
}

export async function acceptTrustedPrintings(
  repos: BatchRepos,
  context: MutationContext,
): Promise<WorkspaceAcceptTrustedPrintingsResponse> {
  assertAdmin(context.access);
  const { eligible, ineligible } = await loadTrustedPrintings(repos);
  let accepted = 0;
  const skipped: WorkspaceAcceptTrustedPrintingsResponse["skipped"] = [...ineligible];

  for (const group of eligible) {
    const printingFields = acceptPrintingFieldsFrom(group.first);
    try {
      const printingId = await acceptPrinting(
        context.transact,
        repos,
        group.cardId,
        printingFields,
        group.candidatePrintingIds,
        context.io,
        { requireNew: true, secondFaceId: null },
      );
      accepted++;
      await recordAdminEvent(repos, context.userId, {
        action: "printing.accept",
        entityType: "printing",
        entityId: printingId,
        entityLabel: printingFields.shortCode,
        cardSlug: group.cardSlug,
        newValues: { printingFields, candidatePrintingIds: group.candidatePrintingIds },
      });
    } catch (error) {
      skipped.push({ label: `${group.cardSlug} ${group.label}`, reason: errorMessage(error) });
    }
  }

  if (accepted > 0) {
    await repos.catalog.refreshCatalogViews();
    await relinkCandidatePrintings(repos);
  }
  return { accepted, skipped };
}

interface StrongListing extends WorkspaceSuggestedListing {
  listing: UnassignedListings["suggested"][number];
}

/** A listing with several strong suggestions is ambiguous and left for a person. */
export function strongListings(listings: UnassignedListings): StrongListing[] {
  const byKey = Map.groupBy(listings.suggested, (listing) =>
    productSuggestionKey(listing.marketplace, listing.externalId, listing.finish, listing.language),
  );
  const out: StrongListing[] = [];
  for (const [listingKey, suggestions] of byKey) {
    const strong = suggestions.filter((suggestion) => suggestion.strength === "strong");
    const [only] = strong;
    if (strong.length !== 1 || !only) {
      continue;
    }
    out.push({
      listingKey,
      printingId: only.printingId,
      label: `${only.productName} → ${only.cardName} ${only.printingLabel}`,
      strength: only.strength,
      listing: only,
    });
  }
  return out.toSorted((a, b) => a.label.localeCompare(b.label));
}

export async function previewSuggestedListings(
  access: AdminAccess | null,
  loadListings: () => Promise<UnassignedListings>,
): Promise<WorkspaceSuggestedListingsPreview> {
  assertAdmin(access);
  const items = strongListings(await loadListings()).map(({ listing: _listing, ...item }) => item);
  return { count: items.length, items };
}

export async function assignSuggestedListings(
  options: {
    access: AdminAccess | null;
    transact: Transact;
    configs: MarketplaceConfigs;
    input: WorkspaceAssignSuggestedListingsInput;
  },
  loadListings: () => Promise<UnassignedListings>,
): Promise<WorkspaceAssignSuggestedListingsResponse> {
  assertAdmin(options.access);
  const wanted = options.input.listingKeys ? new Set(options.input.listingKeys) : null;
  const items = strongListings(await loadListings()).filter(
    (item) => wanted === null || wanted.has(item.listingKey),
  );
  let assigned = 0;
  for (const { listing } of items) {
    try {
      const { saved } = await saveMappings(options.transact, options.configs[listing.marketplace], [
        {
          printingId: listing.printingId,
          externalId: listing.externalId,
          finish: listing.finish,
          language: listing.language,
        },
      ]);
      assigned += saved;
    } catch {
      // A failed listing stays in the queue for a person to assign.
    }
  }
  return { assigned };
}

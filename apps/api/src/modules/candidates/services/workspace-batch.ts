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
import { marketplaceSkuKey } from "@openrift/shared/marketplace-sku-key";
import { errorMessage } from "@openrift/shared/strings";

import type { Repos, Transact } from "../../../deps.js";
import { forbidden } from "../../../errors.js";
import type { Io } from "../../../io.js";
import type { AdminAccess } from "../../../middleware/require-admin.js";
import type { NewPrinting } from "../../catalog/services/printing-admin.js";
import type { MarketplaceConfigs } from "../../marketplace/lib/marketplace-configs.js";
import type { UnassignedListings } from "../../marketplace/lib/unassigned-listings.js";
import { saveMappings } from "../../marketplace/services/marketplace-mapping.js";
import { recordAdminEvent } from "../../system/services/record-admin-event.js";
import { trustedPrintingGroups } from "../lib/workspace-batch.js";
import type {
  IneligibleTrustedCard,
  TrustedCardDraft,
  TrustedPrintingGroup,
} from "../lib/workspace-batch.js";
import { acceptCandidateGroup, finishPrintingAccepts } from "./accept-candidate-printings.js";
import { acceptFavoriteNewCard } from "./accept-gallery.js";
import {
  loadPrintingRefs,
  markAcceptedCandidateCardsChecked,
  trustedCardEligibility,
  trustedPrintingRefusal,
} from "./trusted-accept-checks.js";

type BatchRepos = Pick<
  Repos,
  | "workspaceBatch"
  | "candidateCards"
  | "providerSettings"
  | "catalogMutations"
  | "printingImages"
  | "enums"
  | "distributionChannels"
  | "printingEvents"
  | "catalog"
  | "adminEvents"
  | "ingest"
  | "sets"
  | "keywords"
>;

interface MutationContext {
  access: AdminAccess | null;
  userId: string;
  transact: Transact;
  io: Io;
}

function assertAdmin(access: AdminAccess | null): void {
  if (access?.isAdmin !== true) {
    throw forbidden("Forbidden");
  }
}

async function loadTrustedCards(
  repos: BatchRepos,
): Promise<{ eligible: TrustedCardDraft[]; ineligible: IneligibleTrustedCard[] }> {
  const providers = [...(await repos.providerSettings.favoriteProviders())];
  const drafts = await repos.workspaceBatch.trustedNewCardDrafts(providers);
  return trustedCardEligibility(repos, drafts);
}

export async function previewTrustedCards(
  repos: BatchRepos,
  access: AdminAccess | null,
): Promise<WorkspaceTrustedCardsPreview> {
  assertAdmin(access);
  const { eligible, ineligible } = await loadTrustedCards(repos);
  return { count: eligible.length, names: eligible.map((draft) => draft.name), ineligible };
}

/** Acts only on the drafts named in the preview the admin confirmed. */
export async function acceptTrustedCards(
  repos: BatchRepos,
  context: MutationContext,
  names: readonly string[],
): Promise<WorkspaceAcceptTrustedCardsResponse> {
  assertAdmin(context.access);
  const wanted = new Set(names);
  const loaded = await loadTrustedCards(repos);
  const drafts = loaded.eligible.filter((draft) => wanted.has(draft.name));
  const ineligible = loaded.ineligible.filter((entry) => wanted.has(entry.name));
  const favoriteProviders = await repos.providerSettings.favoriteProviders();
  let accepted = 0;
  const skipped: WorkspaceAcceptTrustedCardsResponse["skipped"] = [...ineligible];
  const created: NewPrinting[] = [];

  for (const draft of drafts) {
    try {
      const result = await acceptFavoriteNewCard(
        context.transact,
        repos,
        draft.normName,
        favoriteProviders,
        created,
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

  await finishPrintingAccepts(repos, context.io, created, { catalogChanged: accepted > 0 });
  return { accepted, skipped };
}

interface IneligibleTrustedPrinting {
  candidatePrintingId: string;
  label: string;
  reason: string;
}

async function loadTrustedPrintings(repos: BatchRepos): Promise<{
  eligible: TrustedPrintingGroup[];
  ineligible: IneligibleTrustedPrinting[];
}> {
  const providers = [...(await repos.providerSettings.favoriteProviders())];
  const rows = await repos.workspaceBatch.trustedNewPrintings(providers);
  const [printings, probes] = await Promise.all([
    repos.candidateCards.allCandidatePrintingsForCandidateCards([
      ...new Set(rows.map((row) => row.candidateCardId)),
    ]),
    repos.workspaceBatch.frontPrintingProbes([...new Set(rows.map((row) => row.cardId))]),
  ]);
  const groups = trustedPrintingGroups(rows, printings);
  const known = await loadPrintingRefs(
    repos,
    groups.map((group) => group.first),
  );
  const eligible: TrustedPrintingGroup[] = [];
  const ineligible: IneligibleTrustedPrinting[] = [];
  for (const group of groups) {
    const reason = await trustedPrintingRefusal(repos, group, known, probes);
    if (reason === null) {
      eligible.push(group);
    } else {
      ineligible.push({
        candidatePrintingId: group.first.id,
        label: `${group.cardSlug} ${group.label}`,
        reason,
      });
    }
  }
  return { eligible, ineligible };
}

export async function previewTrustedPrintings(
  repos: BatchRepos,
  access: AdminAccess | null,
): Promise<WorkspaceTrustedPrintingsPreview> {
  assertAdmin(access);
  const { eligible, ineligible } = await loadTrustedPrintings(repos);
  return {
    count: eligible.length,
    items: eligible.map((group) => ({
      candidatePrintingId: group.first.id,
      cardSlug: group.cardSlug,
      label: group.label,
    })),
    ineligible,
  };
}

/** Acts only on the groups whose first candidate printing the confirmed preview listed. */
export async function acceptTrustedPrintings(
  repos: BatchRepos,
  context: MutationContext,
  candidatePrintingIds: readonly string[],
): Promise<WorkspaceAcceptTrustedPrintingsResponse> {
  assertAdmin(context.access);
  const wanted = new Set(candidatePrintingIds);
  const loaded = await loadTrustedPrintings(repos);
  const eligible = loaded.eligible.filter((group) => wanted.has(group.first.id));
  const ineligible = loaded.ineligible.filter((entry) => wanted.has(entry.candidatePrintingId));
  const skipped: WorkspaceAcceptTrustedPrintingsResponse["skipped"] = ineligible.map(
    ({ label, reason }) => ({ label, reason }),
  );
  const created: NewPrinting[] = [];

  const acceptedGroups: TrustedPrintingGroup[] = [];
  try {
    for (const group of eligible) {
      const outcome = await acceptCandidateGroup(context.transact, group.cardId, group.candidates);
      if (!("printing" in outcome)) {
        skipped.push({ label: `${group.cardSlug} ${group.label}`, reason: outcome.reason });
        continue;
      }
      created.push(outcome.printing);
      acceptedGroups.push(group);
      await recordAdminEvent(repos, context.userId, {
        action: "printing.accept",
        entityType: "printing",
        entityId: outcome.printing.printingId,
        entityLabel: outcome.fields.shortCode,
        cardSlug: group.cardSlug,
        newValues: {
          printingFields: outcome.fields,
          candidatePrintingIds: group.candidates.map((cp) => cp.id),
        },
      });
    }
    await markAcceptedCandidateCardsChecked(repos, acceptedGroups);
  } finally {
    await finishPrintingAccepts(repos, context.io, created);
  }
  return { accepted: created.length, skipped };
}

interface StrongListing extends WorkspaceSuggestedListing {
  listing: UnassignedListings["suggested"][number];
}

/** A listing with several strong suggestions is ambiguous and left for a person. */
export function strongListings(listings: UnassignedListings): StrongListing[] {
  const byKey = Map.groupBy(listings.suggested, (listing) =>
    marketplaceSkuKey(listing.marketplace, listing.externalId, listing.finish, listing.language),
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
  const skipped: WorkspaceAssignSuggestedListingsResponse["skipped"] = [];
  for (const { label, listing } of items) {
    try {
      const { saved, skipped: refused } = await saveMappings(
        options.transact,
        options.configs[listing.marketplace],
        [
          {
            printingId: listing.printingId,
            externalId: listing.externalId,
            finish: listing.finish,
            language: listing.language,
          },
        ],
      );
      assigned += saved;
      skipped.push(...refused.map(({ reason }) => ({ label, reason })));
    } catch (error) {
      skipped.push({ label, reason: errorMessage(error) });
    }
  }
  return { assigned, skipped };
}

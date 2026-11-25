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
import { mappingEvents, saveMappings } from "../../marketplace/services/marketplace-mapping.js";
import { recordAdminEvent, recordAdminEvents } from "../../system/services/record-admin-event.js";
import { candidatePrintingLabel } from "../lib/candidate-printing-accept.js";
import {
  goneReason,
  trustedPrintingGroups,
  uncoveredCandidateIds,
} from "../lib/workspace-batch.js";
import type {
  IneligibleTrustedCard,
  TrustedCardDraft,
  TrustedPrintingGroup,
} from "../lib/workspace-batch.js";
import { acceptCandidateGroup, finishPrintingAccepts } from "./accept-candidate-printings.js";
import { acceptFavoriteNewCard, favoriteAcceptEvents } from "./accept-gallery.js";
import { recordCandidateChecks } from "./check-card-candidates.js";
import {
  loadPrintingRefs,
  markAcceptedCandidateCardsChecked,
  trustedCardEligibility,
  trustedPrintingRefusals,
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

async function loadTrustedCards(repos: BatchRepos): Promise<{
  eligible: TrustedCardDraft[];
  ineligible: IneligibleTrustedCard[];
  favoriteProviders: ReadonlySet<string>;
}> {
  const favoriteProviders = await repos.providerSettings.favoriteProviders();
  const drafts = await repos.workspaceBatch.trustedNewCardDrafts([...favoriteProviders]);
  return { ...(await trustedCardEligibility(repos, drafts)), favoriteProviders };
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
  const { favoriteProviders } = loaded;
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
      skipped.push(
        ...result.skipped.map((entry) => ({
          name: `${draft.name} ${entry.shortCode}`,
          reason: entry.reason,
        })),
      );
      await recordAdminEvents(repos, context.userId, () =>
        Promise.resolve(favoriteAcceptEvents(result, draft.normName)),
      );
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
  group: TrustedPrintingGroup;
}

async function loadTrustedPrintings(repos: BatchRepos): Promise<{
  eligible: TrustedPrintingGroup[];
  ineligible: IneligibleTrustedPrinting[];
  favorites: ReadonlySet<string>;
  providersOf: (group: TrustedPrintingGroup) => string[];
}> {
  const favorites = await repos.providerSettings.favoriteProviders();
  const providers = [...favorites];
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
  const refusals = await trustedPrintingRefusals(repos, groups, known, probes);
  const eligible: TrustedPrintingGroup[] = [];
  const ineligible: IneligibleTrustedPrinting[] = [];
  for (const [index, group] of groups.entries()) {
    const reason = refusals[index] ?? null;
    if (reason === null) {
      eligible.push(group);
    } else {
      ineligible.push({
        candidatePrintingId: group.first.id,
        label: `${group.cardSlug} ${group.label}`,
        reason,
        group,
      });
    }
  }
  const providerById = new Map(rows.map((row) => [row.id, row.provider]));
  const providersOf = (group: TrustedPrintingGroup): string[] =>
    [...new Set(group.candidates.flatMap((cp) => providerById.get(cp.id) ?? []))].toSorted();
  return { eligible, ineligible, favorites, providersOf };
}

export async function previewTrustedPrintings(
  repos: BatchRepos,
  access: AdminAccess | null,
): Promise<WorkspaceTrustedPrintingsPreview> {
  assertAdmin(access);
  const { eligible, ineligible, providersOf } = await loadTrustedPrintings(repos);
  return {
    count: eligible.length,
    items: eligible.map((group) => ({
      candidatePrintingId: group.first.id,
      cardSlug: group.cardSlug,
      label: group.label,
      providers: providersOf(group),
    })),
    ineligible: ineligible.map(({ candidatePrintingId, reason, group }) => ({
      candidatePrintingId,
      cardSlug: group.cardSlug,
      label: group.label,
      providers: providersOf(group),
      reason,
    })),
  };
}

/**
 * Acts only on the groups holding a candidate printing the confirmed preview listed. Each listed
 * id is reported: its group's outcome, a skip naming the group it joined, or why it left the batch.
 */
export async function acceptTrustedPrintings(
  repos: BatchRepos,
  context: MutationContext,
  candidatePrintingIds: readonly string[],
): Promise<WorkspaceAcceptTrustedPrintingsResponse> {
  assertAdmin(context.access);
  const wanted = new Set(candidatePrintingIds);
  const loaded = await loadTrustedPrintings(repos);
  const listed = (group: TrustedPrintingGroup) => group.candidates.some((cp) => wanted.has(cp.id));
  const eligible = loaded.eligible.filter(listed);
  const ineligible = loaded.ineligible.filter((entry) => listed(entry.group));
  const skipped: WorkspaceAcceptTrustedPrintingsResponse["skipped"] = ineligible.map(
    ({ label, reason }) => ({ label, reason }),
  );
  const gone = uncoveredCandidateIds(candidatePrintingIds, [
    ...eligible,
    ...ineligible.map((entry) => entry.group),
  ]);
  const goneLabels =
    gone.length === 0 ? [] : await repos.workspaceBatch.candidatePrintingLabels(gone);
  const goneRows = new Map(goneLabels.map((row) => [row.id, row]));
  for (const id of gone) {
    const row = goneRows.get(id);
    const label = row === undefined ? id : `${row.cardSlug} ${candidatePrintingLabel(row)}`;
    skipped.push({ label, reason: goneReason(row, loaded.favorites) });
  }
  for (const group of [...eligible, ...ineligible.map((entry) => entry.group)]) {
    const groupLabel = `${group.cardSlug} ${group.label}`;
    const joined = group.candidates.filter((cp) => wanted.has(cp.id)).slice(1);
    for (const cp of joined) {
      skipped.push({
        label: `${group.cardSlug} ${candidatePrintingLabel(cp)}`,
        reason: `Same printing as ${groupLabel}, handled with it`,
      });
    }
  }
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
    const checked = await markAcceptedCandidateCardsChecked(repos, acceptedGroups);
    await recordCandidateChecks(repos, context.userId, "candidate-card.check", { ids: checked });
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

/** Acts only on the listings named in the confirmed preview, one save per marketplace; a failed
 *  save skips every listing of its marketplace. */
export async function assignSuggestedListings(
  options: {
    access: AdminAccess | null;
    userId: string;
    repos: Pick<Repos, "adminEvents" | "marketplaceAdmin">;
    transact: Transact;
    configs: MarketplaceConfigs;
    input: WorkspaceAssignSuggestedListingsInput;
  },
  loadListings: () => Promise<UnassignedListings>,
): Promise<WorkspaceAssignSuggestedListingsResponse> {
  assertAdmin(options.access);
  const wanted = new Set(options.input.listingKeys);
  const items = strongListings(await loadListings()).filter((item) => wanted.has(item.listingKey));
  let assigned = 0;
  const skipped: WorkspaceAssignSuggestedListingsResponse["skipped"] = [];
  for (const [marketplace, group] of Map.groupBy(items, (item) => item.listing.marketplace)) {
    try {
      const {
        saved,
        skipped: refused,
        applied,
      } = await saveMappings(
        options.transact,
        options.configs[marketplace],
        group.map(({ listing }) => ({
          printingId: listing.printingId,
          externalId: listing.externalId,
          finish: listing.finish,
          language: listing.language,
        })),
      );
      assigned += saved;
      const appliedKeys = new Set(
        applied.map((mapping) =>
          marketplaceSkuKey(marketplace, mapping.externalId, mapping.finish, mapping.language),
        ),
      );
      const reasonOf = new Map(refused.map((entry) => [entry.externalId, entry.reason]));
      for (const { label, listingKey, listing } of group) {
        if (!appliedKeys.has(listingKey)) {
          skipped.push({ label, reason: reasonOf.get(listing.externalId) ?? "not saved" });
        }
      }
      await recordAdminEvents(options.repos, options.userId, () =>
        mappingEvents(options.repos, marketplace, applied),
      );
    } catch (error) {
      skipped.push(...group.map(({ label }) => ({ label, reason: errorMessage(error) })));
    }
  }
  return { assigned, skipped };
}

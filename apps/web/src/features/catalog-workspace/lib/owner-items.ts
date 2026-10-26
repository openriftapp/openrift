import { matchesCardQuery } from "@openrift/shared/card-search";
import type {
  WorkspaceListingVariant,
  WorkspaceOwner,
  WorkspaceQueueItem,
  WorkspaceReason,
  WorkspaceRecordRow,
  WorkspaceSegment,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { ENGLISH_DATE_WORDS, formatRelativeTime } from "@openrift/shared/format-date";
import { pluralize } from "@openrift/shared/strings";
import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";

import {
  CARD_FIELD_LABELS,
  PRINTING_FIELD_LABELS,
} from "@/features/admin/lib/catalog-field-labels";
import { deskPrintingCodes, deskPrintingName } from "@/features/admin/lib/desk-face-options";

import type { WorkspaceSearch, WorkspaceSort } from "./workspace-search";

export type WorkspaceTarget =
  | { kind: "card"; cardSlug: string }
  | { kind: "card-new"; name: string }
  | { kind: "face"; cardSlug: string; faceId: string }
  | { kind: "printing"; printingId: string }
  | { kind: "printing-new"; candidatePrintingId: string };

export type WorkspaceRole = "admin" | "reviewer" | "desk" | "none";

export type DeskMode = "mine" | "promos";

export type DeskRow = DeskPrintingRow;

export interface WorkspaceRouteParams {
  cardSlug?: string;
  name?: string;
  faceId?: string;
  printingId?: string;
  candidatePrintingId?: string;
}

export interface OwnerGroup {
  key: string;
  owner: WorkspaceOwner;
  segment: WorkspaceSegment;
  ownerId: string;
  cardSlug: string | null;
  cardName: string;
  label: string;
  reasons: WorkspaceReason[];
  providers: string[];
  isContributor: boolean;
  contributorOnly: boolean;
  fields: string[];
  variants: WorkspaceListingVariant[];
  decisions: number;
  oldestAt: string;
  newestAt: string;
  target: WorkspaceTarget | null;
}

export interface ListEntry {
  key: string;
  title: string;
  code?: string;
  detail: string;
  imageUrl?: string | null;
  createdAt?: string;
  decisions?: number;
  draft?: boolean;
  target: WorkspaceTarget | null;
}

const OWNER_ORDER: readonly WorkspaceOwner[] = ["card", "face", "printing"];

export const OWNER_LABELS: Record<WorkspaceOwner, string> = {
  card: "Cards",
  face: "Faces",
  printing: "Printings",
};

export const REASON_LABELS: Record<WorkspaceReason, string> = {
  "source-difference": "Source differences",
  "contributor-proposal": "Contributor proposal",
  "new-card": "New card",
  "new-printing": "New printing",
  "new-image": "New image",
  listing: "Listing",
};

export const SORT_LABELS: Record<WorkspaceSort, string> = {
  oldest: "Oldest",
  newest: "Newest",
  card: "Card name",
};

export function workspaceRole(
  access: { isAdmin: boolean; sections: readonly string[] } | undefined,
): WorkspaceRole {
  if (access === undefined) {
    return "none";
  }
  if (access.isAdmin) {
    return "admin";
  }
  if (access.sections.includes("card-review")) {
    return "reviewer";
  }
  if (access.sections.includes("printing-desk")) {
    return "desk";
  }
  return "none";
}

export function ownersForRole(role: WorkspaceRole): readonly WorkspaceOwner[] {
  if (role === "admin" || role === "reviewer") {
    return OWNER_ORDER;
  }
  if (role === "desk") {
    return ["printing"];
  }
  return [];
}

export function visibleQueueItems(
  items: readonly WorkspaceQueueItem[],
  role: WorkspaceRole,
): WorkspaceQueueItem[] {
  const owners = ownersForRole(role);
  return items.filter((item) => owners.includes(item.owner));
}

export function targetKey(target: WorkspaceTarget): string {
  switch (target.kind) {
    case "card": {
      return `card:${target.cardSlug}`;
    }
    case "card-new": {
      return `card-new:${target.name}`;
    }
    case "face": {
      return `face:${target.faceId}`;
    }
    case "printing": {
      return `printing:${target.printingId}`;
    }
    case "printing-new": {
      return `printing-new:${target.candidatePrintingId}`;
    }
  }
}

export function selectedKeyFromParams(params: WorkspaceRouteParams): string | null {
  if (params.name !== undefined) {
    return `card-new:${params.name}`;
  }
  if (params.faceId !== undefined) {
    return `face:${params.faceId}`;
  }
  if (params.candidatePrintingId !== undefined) {
    return `printing-new:${params.candidatePrintingId}`;
  }
  if (params.printingId !== undefined) {
    return `printing:${params.printingId}`;
  }
  if (params.cardSlug !== undefined) {
    return `card:${params.cardSlug}`;
  }
  return null;
}

export function itemTarget(item: WorkspaceQueueItem): WorkspaceTarget | null {
  switch (item.owner) {
    case "card": {
      return item.segment === "new"
        ? { kind: "card-new", name: item.ownerId }
        : { kind: "card", cardSlug: item.ownerId };
    }
    case "face": {
      return item.cardSlug === null
        ? null
        : { kind: "face", cardSlug: item.cardSlug, faceId: item.ownerId };
    }
    case "printing": {
      return item.segment === "new"
        ? { kind: "printing-new", candidatePrintingId: item.ownerId }
        : { kind: "printing", printingId: item.ownerId };
    }
  }
}

export function groupOwnerItems(items: readonly WorkspaceQueueItem[]): OwnerGroup[] {
  const groups = new Map<string, OwnerGroup>();
  for (const item of items) {
    const target = itemTarget(item);
    const key = target ? targetKey(target) : `${item.owner}:${item.segment}:${item.ownerId}`;
    const existing = groups.get(key);
    const provider = item.isContributor ? null : item.provider;
    if (existing === undefined) {
      groups.set(key, {
        key,
        owner: item.owner,
        segment: item.segment,
        ownerId: item.ownerId,
        cardSlug: item.cardSlug,
        cardName: item.cardName,
        label: item.label,
        reasons: [item.reason],
        providers: provider === null ? [] : [provider],
        isContributor: item.isContributor,
        contributorOnly: item.isContributor,
        fields: [...new Set(item.fields)],
        variants: item.variants ?? [],
        decisions: item.decisions,
        oldestAt: item.createdAt,
        newestAt: item.createdAt,
        target,
      });
      continue;
    }
    if (!existing.reasons.includes(item.reason)) {
      existing.reasons.push(item.reason);
    }
    if (provider !== null && !existing.providers.includes(provider)) {
      existing.providers.push(provider);
    }
    existing.isContributor ||= item.isContributor;
    existing.contributorOnly &&= item.isContributor;
    for (const field of item.fields) {
      if (!existing.fields.includes(field)) {
        existing.fields.push(field);
      }
    }
    existing.variants.push(...(item.variants ?? []));
    existing.decisions += item.decisions;
    if (item.createdAt < existing.oldestAt) {
      existing.oldestAt = item.createdAt;
    }
    if (item.createdAt > existing.newestAt) {
      existing.newestAt = item.createdAt;
    }
  }
  return [...groups.values()];
}

function groupMatchesSource(
  group: OwnerGroup,
  search: Pick<WorkspaceSearch, "provider" | "reason">,
): boolean {
  return (
    (search.provider === undefined || group.providers.includes(search.provider)) &&
    (search.reason === undefined || group.reasons.includes(search.reason))
  );
}

export function filterGroups(
  groups: readonly OwnerGroup[],
  search: Pick<WorkspaceSearch, "q" | "provider" | "reason">,
): OwnerGroup[] {
  const query = search.q?.trim() ?? "";
  return groups.filter(
    (group) =>
      groupMatchesSource(group, search) &&
      (query === "" || matchesCardQuery(query, [group.cardName, group.label])),
  );
}

function hasSourceFilter(search: Pick<WorkspaceSearch, "provider" | "reason">): boolean {
  return search.provider !== undefined || search.reason !== undefined;
}

export function rowMatchesSource(
  group: OwnerGroup | undefined,
  search: Pick<WorkspaceSearch, "provider" | "reason">,
): boolean {
  if (!hasSourceFilter(search)) {
    return true;
  }
  return group !== undefined && groupMatchesSource(group, search);
}

export function sortGroups(
  groups: readonly OwnerGroup[],
  order: WorkspaceSort,
  skipped: readonly string[] = [],
): OwnerGroup[] {
  const sorted = groups.toSorted((a, b) => {
    if (order === "newest") {
      return b.newestAt.localeCompare(a.newestAt);
    }
    if (order === "card") {
      return a.cardName.localeCompare(b.cardName) || a.label.localeCompare(b.label);
    }
    return a.oldestAt.localeCompare(b.oldestAt);
  });
  if (skipped.length === 0) {
    return sorted;
  }
  const rank = new Map(skipped.map((key, index) => [key, index]));
  return [
    ...sorted.filter((group) => !rank.has(group.key)),
    ...sorted
      .filter((group) => rank.has(group.key))
      .toSorted((a, b) => (rank.get(a.key) ?? 0) - (rank.get(b.key) ?? 0)),
  ];
}

const EXTRA_FIELD_LABELS: Record<string, string> = {
  rulesText: "Rules text",
  effectText: "Effect text",
  printedRulesText: "Printed rules",
  printedEffectText: "Printed effect",
  flavorText: "Flavor text",
  keywords: "Keywords",
};

const NON_FIELD_KEYS: ReadonlySet<string> = new Set(["listing"]);

const FIELD_LABELS: Record<string, string> = {
  ...PRINTING_FIELD_LABELS,
  ...CARD_FIELD_LABELS,
  ...EXTRA_FIELD_LABELS,
};

export function fieldLabel(field: string): string {
  const known = FIELD_LABELS[field];
  if (known !== undefined) {
    return known;
  }
  const words = field
    .replaceAll(/(?<lower>[a-z0-9])(?<upper>[A-Z])/gu, "$<lower> $<upper>")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function detailFields(fields: readonly string[]): string[] {
  return fields.filter((field) => !NON_FIELD_KEYS.has(field));
}

function fieldsSummary(fields: readonly string[]): string {
  return fields
    .map((field, index) => (index === 0 ? fieldLabel(field) : fieldLabel(field).toLowerCase()))
    .join(" · ");
}

const MAX_VARIANTS = 3;

export function listingVariantsText(variants: readonly WorkspaceListingVariant[]): string {
  const total = variants.reduce((sum, variant) => sum + variant.count, 0);
  const shown = variants
    .slice(0, MAX_VARIANTS)
    .map((variant) =>
      [variant.language, variant.finish, `×${variant.count}`].filter(Boolean).join(" "),
    );
  const more = variants.length > MAX_VARIANTS ? ", …" : "";
  return `${total} ${pluralize(total, "listing")} · ${shown.join(", ")}${more}`;
}

export function groupDetail(group: OwnerGroup): string {
  if (group.variants.length > 0) {
    return listingVariantsText(group.variants);
  }
  const fields = detailFields(group.fields);
  if (fields.length > 0) {
    const summary = fieldsSummary(fields);
    return group.contributorOnly ? `${summary} (contributor)` : summary;
  }
  const reasons = group.reasons.map((reason) => REASON_LABELS[reason]).join(" · ");
  return group.providers.length === 0 ? reasons : `${reasons} · ${group.providers.join(", ")}`;
}

function entryCode(group: OwnerGroup): string | undefined {
  if (group.owner === "card" || group.label === group.cardName) {
    return undefined;
  }
  const titled = `${group.cardName} · `;
  return group.label.startsWith(titled) ? group.label.slice(titled.length) : group.label;
}

export function groupEntry(group: OwnerGroup): ListEntry {
  return {
    key: group.key,
    title: group.cardName,
    code: entryCode(group),
    detail: groupDetail(group),
    createdAt: group.oldestAt,
    decisions: group.decisions,
    draft: group.segment === "new",
    target: group.target,
  };
}

export function groupsByKey(groups: readonly OwnerGroup[]): Map<string, OwnerGroup> {
  return new Map(groups.map((group) => [group.key, group]));
}

type OpenBadgeVariant = "warning" | "violet" | "neutral" | "info";

export interface OpenBadge {
  label: string;
  variant: OpenBadgeVariant;
}

const MAX_FIELD_BADGES = 3;

export function cardOpenBadges(
  row: CandidateCardSummaryResponse,
  group: OwnerGroup | undefined,
): OpenBadge[] {
  const badges: OpenBadge[] = [];
  if (row.cardSlug === null) {
    badges.push({
      label: `${row.candidateCount} ${pluralize(row.candidateCount, "source")}`,
      variant: "neutral",
    });
    if (row.uncheckedTrustedProviders.length > 0) {
      badges.push({ label: "Trusted", variant: "info" });
    }
  }
  const fields = group === undefined || group.contributorOnly ? [] : detailFields(group.fields);
  for (const field of fields.slice(0, MAX_FIELD_BADGES)) {
    badges.push({ label: `${fieldLabel(field)} differs`, variant: "warning" });
  }
  if (fields.length > MAX_FIELD_BADGES) {
    badges.push({ label: `+${fields.length - MAX_FIELD_BADGES} more`, variant: "warning" });
  }
  const fromSources = row.uncheckedCardCount + row.uncheckedPrintingCount;
  if (fields.length === 0 && row.cardSlug !== null && fromSources > 0) {
    badges.push({ label: `${fromSources} from sources`, variant: "warning" });
  }
  if (row.pendingSubmissions > 0) {
    badges.push({
      label: `${row.pendingSubmissions} ${pluralize(row.pendingSubmissions, "proposal")}`,
      variant: "violet",
    });
  }
  return badges;
}

export function cardSummaryKey(row: CandidateCardSummaryResponse): string {
  const target = cardSummaryTarget(row);
  return target ? targetKey(target) : `card-row:${row.name}`;
}

export function queueStats(groups: readonly OwnerGroup[]): {
  decisions: number;
  oldestAt: string | null;
} {
  let decisions = 0;
  let oldestAt: string | null = null;
  for (const group of groups) {
    decisions += group.decisions;
    if (oldestAt === null || group.oldestAt < oldestAt) {
      oldestAt = group.oldestAt;
    }
  }
  return { decisions, oldestAt };
}

export function segmentCounts(groups: readonly OwnerGroup[]): { open: number; new: number } {
  return {
    open: groups.filter((group) => group.segment === "open").length,
    new: groups.filter((group) => group.segment === "new").length,
  };
}

export function distinctProviders(groups: readonly OwnerGroup[]): string[] {
  return [...new Set(groups.flatMap((group) => group.providers))].toSorted();
}

export function nextQueue(
  items: readonly WorkspaceQueueItem[],
  current: WorkspaceOwner,
  role: WorkspaceRole,
): { owner: WorkspaceOwner; count: number; segment: WorkspaceSegment } | null {
  const owners = ownersForRole(role);
  const start = owners.indexOf(current);
  const groups = groupOwnerItems(visibleQueueItems(items, role));
  for (let step = 1; step <= owners.length; step++) {
    const owner = owners[(start + step) % owners.length];
    if (owner === undefined || owner === current) {
      continue;
    }
    const counts = segmentCounts(groups.filter((group) => group.owner === owner));
    if (counts.open + counts.new > 0) {
      return { owner, count: counts.open + counts.new, segment: counts.open > 0 ? "open" : "new" };
    }
  }
  return null;
}

export function oldestItem(
  items: readonly WorkspaceQueueItem[],
  role: WorkspaceRole,
): WorkspaceQueueItem | null {
  let oldest: WorkspaceQueueItem | null = null;
  for (const item of visibleQueueItems(items, role)) {
    if (itemTarget(item) !== null && (oldest === null || item.createdAt < oldest.createdAt)) {
      oldest = item;
    }
  }
  return oldest;
}

export function stepIndex(length: number, current: number, delta: 1 | -1): number | null {
  if (length === 0) {
    return null;
  }
  if (current < 0) {
    return delta > 0 ? 0 : null;
  }
  const next = current + delta;
  if (next >= 0 && next < length) {
    return next;
  }
  if (delta > 0 && length > 1) {
    return 0;
  }
  return null;
}

const AGE_WORDS = { ...ENGLISH_DATE_WORDS, ago: (time: string) => time };

export function compactAge(createdAt: string, now?: Date): string {
  return formatRelativeTime(createdAt, { now, words: AGE_WORDS });
}

export function recordEntry(owner: "face" | "printing", row: WorkspaceRecordRow): ListEntry {
  return {
    key: owner === "face" ? `face:${row.id}` : `printing:${row.id}`,
    title: row.cardName,
    code: row.shortCode,
    detail: [row.setName, row.language.toUpperCase(), row.finish].filter(Boolean).join(" · "),
    imageUrl: row.imageUrl,
    target:
      owner === "face"
        ? { kind: "face", cardSlug: row.cardSlug, faceId: row.id }
        : { kind: "printing", printingId: row.id },
  };
}

export function cardSummaryTarget(row: CandidateCardSummaryResponse): WorkspaceTarget | null {
  if (row.cardSlug !== null) {
    return { kind: "card", cardSlug: row.cardSlug };
  }
  return row.normalizedName === "" ? null : { kind: "card-new", name: row.normalizedName };
}

function cardSummaryOpen(row: CandidateCardSummaryResponse): number {
  return row.uncheckedCardCount + row.uncheckedPrintingCount + row.pendingSubmissions;
}

export function cardSummaryEntry(row: CandidateCardSummaryResponse): ListEntry {
  const target = cardSummaryTarget(row);
  const open = cardSummaryOpen(row);
  return {
    key: cardSummaryKey(row),
    title: row.name,
    detail: row.cardSlug === null ? "New card" : (row.setSlugs.at(0) ?? ""),
    decisions: open > 0 ? open : undefined,
    draft: row.cardSlug === null,
    target,
  };
}

export function deskEntry(row: DeskRow): ListEntry {
  return {
    key: `printing:${row.printingId}`,
    title: deskPrintingName(row),
    code: deskPrintingCodes(row),
    detail: [row.setName, row.language.toUpperCase(), row.finish].join(" · "),
    imageUrl: row.activeImageUrl,
    target: { kind: "printing", printingId: row.printingId },
  };
}

export function filterCardSummaries(
  rows: readonly CandidateCardSummaryResponse[],
  query: string | undefined,
): CandidateCardSummaryResponse[] {
  const trimmed = query?.trim() ?? "";
  return rows
    .filter(
      (row) =>
        trimmed === "" ||
        matchesCardQuery(trimmed, [row.name, ...row.shortCodes, ...row.stagingShortCodes]),
    )
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

export function filterDeskRows(rows: readonly DeskRow[], query: string | undefined): DeskRow[] {
  const trimmed = query?.trim() ?? "";
  if (trimmed === "") {
    return [...rows];
  }
  return rows.filter((row) =>
    matchesCardQuery(trimmed, [
      row.cardName,
      row.shortCode,
      row.secondSide?.cardName,
      row.secondSide?.shortCode,
    ]),
  );
}

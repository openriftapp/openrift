import { z } from "zod";

import { ERROR_CODES } from "./error-codes.js";
import type { ErrorCode } from "./error-codes.js";
import { isAllowedLinkUrl } from "./link-hosts.js";
import { GROUP_CUT_TIERS } from "./pairing/group-cut-types.js";
import {
  META_CREDIT_VISIBILITIES,
  META_ENTRY_STATUSES,
  META_EVENT_STATUSES,
  META_EVENT_TIERS,
  META_LIST_STATUSES,
  META_OVERLAY_STATUSES,
  META_SUBMISSION_KINDS,
  META_SUBMISSION_REASONS,
  META_SUBMISSION_STATUSES,
} from "./types/enums.js";
import { WellKnown } from "./well-known.js";

// `details` (validation issues / dev stack) is deliberately not in the schema:
// a `z.unknown()` field would break createServerFn's return-type check.
const errorCodeValues = Object.values(ERROR_CODES) as [ErrorCode, ...ErrorCode[]];

export const apiErrorResponseSchema = z.object({
  error: z.string().meta({ examples: ["Not found"] }),
  code: z.enum(errorCodeValues).meta({ examples: [ERROR_CODES.NOT_FOUND] }),
});

// Deliberately non-recursive: a fully recursive JSON type breaks @hono/zod-openapi
// (TS2589) and leaks the ZodType through hc's response-type inference.
const diffScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type DiffValue = z.infer<typeof diffScalarSchema> | z.infer<typeof diffScalarSchema>[];
export const diffValueSchema = z.union([diffScalarSchema, z.array(diffScalarSchema)]);

export const cardTypeSchema = z.string().meta({ examples: ["Unit"] });
export const raritySchema = z.string().meta({ examples: ["Epic"] });
export const domainSchema = z.string().meta({ examples: ["Chaos"] });
export const superTypeSchema = z.string().meta({ examples: ["Champion"] });
export const artVariantSchema = z.string().meta({ examples: ["normal"] });
export const finishSchema = z.string().meta({ examples: ["foil"] });
export const cardSizeSchema = z.string().meta({ examples: ["standard"] });

export const deckFormatSchema = z.string().meta({ examples: ["constructed"] });

// Checked against the `deck_zones` reference table at API startup.
const DECK_ZONE_VALUES = [
  WellKnown.deckZone.MAIN,
  WellKnown.deckZone.SIDEBOARD,
  WellKnown.deckZone.LEGEND,
  WellKnown.deckZone.CHAMPION,
  WellKnown.deckZone.RUNES,
  WellKnown.deckZone.BATTLEFIELD,
  WellKnown.deckZone.OVERFLOW,
] as const;
export const deckZoneSchema = z.enum(DECK_ZONE_VALUES);
export const cardFaceSchema = z.enum(["front", "back"]);

export const metaListStatusSchema = z.enum(META_LIST_STATUSES);

export const metaEventTierSchema = z.enum(META_EVENT_TIERS);

export const metaEventStatusSchema = z.enum(META_EVENT_STATUSES);

export const metaEntryStatusSchema = z.enum(META_ENTRY_STATUSES);

export const metaOverlayStatusSchema = z.enum(META_OVERLAY_STATUSES);

export const metaCreditVisibilitySchema = z.enum(META_CREDIT_VISIBILITIES);

export const metaSubmissionStatusSchema = z.enum(META_SUBMISSION_STATUSES);

export const metaSubmissionReasonSchema = z.enum(META_SUBMISSION_REASONS);

export const metaSubmissionKindSchema = z.enum(META_SUBMISSION_KINDS);

export const healthResponseSchema = z.object({ status: z.string().meta({ examples: ["ok"] }) });

export const distributionChannelSchema = z.object({
  id: z.string().meta({ examples: ["019cfc3b-0369-7000-8000-000000000002"] }),
  slug: z.string().meta({ examples: ["nexus-night"] }),
  label: z.string().meta({ examples: ["Nexus Night"] }),
  description: z
    .string()
    .nullable()
    .meta({ examples: [null] }),
  kind: z.enum(["event", "product"]).meta({ examples: ["event"] }),
  parentId: z
    .string()
    .nullable()
    .meta({ examples: [null] }),
  childrenLabel: z
    .string()
    .nullable()
    .meta({ examples: [null] }),
});

/** `releasedAt` is the first day of the period; both null means announced with no date. */
export const setReleaseSchema = z.object({
  releasedAt: z
    .string()
    .nullable()
    .meta({ examples: ["2025-10-31"] }),
  precision: z
    .enum(["day", "month", "quarter", "year"])
    .nullable()
    .meta({ examples: ["day"] }),
});

export const catalogSetResponseSchema = z.object({
  id: z.string().meta({ examples: ["019cfc3b-0369-7890-a450-7859471cc3f6"] }),
  slug: z.string().meta({ examples: ["OGN"] }),
  name: z.string().meta({ examples: ["Origins"] }),
  /** Release period per language code. A missing key means not announced there. */
  releases: z.record(z.string(), setReleaseSchema).meta({
    examples: [
      {
        EN: { releasedAt: "2025-10-31", precision: "day" },
        FR: { releasedAt: "2026-04-01", precision: "quarter" },
      },
    ],
  }),
  setType: z.enum(["main", "supplemental"]).meta({ examples: ["main"] }),
});

const markerSchema = z.object({
  id: z.string().meta({ examples: ["019cfc3b-0369-7000-8000-000000000001"] }),
  slug: z.string().meta({ examples: ["promo"] }),
  label: z.string().meta({ examples: ["Promo"] }),
  description: z
    .string()
    .nullable()
    .meta({ examples: [null] }),
});

const printingDistributionChannelSchema = z.object({
  channel: distributionChannelSchema,
  distributionNote: z
    .string()
    .nullable()
    .meta({ examples: [null] }),
  ancestorLabels: z.array(z.string()).meta({ examples: [[]] }),
});

export const imageIdSchema = z
  .string()
  .meta({ examples: ["019d02f1-d14f-769f-9295-9852db692dbe"] });

const printingImageSchema = z.object({
  face: cardFaceSchema,
  imageId: imageIdSchema,
  credit: z
    .string()
    .optional()
    .meta({ examples: ["gamesnight"] }),
});

/** `sourceUrl` is nullable: some citations have no permalink at all. */
const printingCitationSchema = z.object({
  id: z.string().meta({ examples: ["019d02f1-d14f-769f-9295-9852db692dbe"] }),
  label: z.string().meta({ examples: ["Launch party unboxing (RiftboundDaily)"] }),
  sourceUrl: z
    .string()
    .nullable()
    .meta({ examples: ["https://www.youtube.com/watch?v=abc123"] }),
});

const cardBanSchema = z.object({
  formatId: z.string().meta({ examples: ["019cfc3b-0369-7000-8000-000000000002"] }),
  formatName: z.string().meta({ examples: ["Constructed"] }),
  bannedAt: z.string().meta({ examples: ["2026-01-15"] }),
  reason: z
    .string()
    .nullable()
    .meta({ examples: ["Power level"] }),
});

export const catalogCardResponseSchema = z.object({
  id: z.string().meta({ examples: ["019cfc3b-0389-744b-837c-792fd586300e"] }),
  slug: z.string().meta({ examples: ["jinx-rebel"] }),
  name: z.string().meta({ examples: ["Jinx, Rebel"] }),
  type: cardTypeSchema,
  types: z
    .array(cardTypeSchema)
    .nonempty()
    .meta({ examples: [["Unit"]] }),
  superTypes: z.array(superTypeSchema).meta({ examples: [["Champion"]] }),
  domains: z.array(domainSchema).meta({ examples: [["Chaos"]] }),
  tokenCardIds: z.array(z.string()).meta({ examples: [["019cfc3b-0389-744b-837c-792fd586300f"]] }),
  might: z
    .number()
    .nullable()
    .meta({ examples: [5] }),
  energy: z
    .number()
    .nullable()
    .meta({ examples: [5] }),
  power: z
    .number()
    .nullable()
    .meta({ examples: [null] }),
  keywords: z.array(z.string()).meta({ examples: [[]] }),
  tags: z.array(z.string()).meta({ examples: [[]] }),
  mightBonus: z
    .number()
    .nullable()
    .meta({ examples: [null] }),
  maxCopiesOverride: z
    .number()
    .nullable()
    .meta({ examples: [null] }),
  errata: z
    .object({
      correctedRulesText: z.string().nullable(),
      correctedEffectText: z.string().nullable(),
      source: z.string(),
      sourceUrl: z.string().nullable(),
      effectiveDate: z.string().nullable(),
    })
    .nullable()
    .meta({ examples: [null] }),
  bans: z.array(cardBanSchema).meta({ examples: [[]] }),
});

export const catalogPrintingResponseSchema = z.object({
  id: z.string().meta({ examples: ["019cfc3b-03d3-7dac-86c9-27900cd43727"] }),
  // Card detail only: the browse payload is one row per printing of every card.
  slug: z
    .string()
    .optional()
    .meta({ examples: ["en-ogn-202-foil-promo-standard"] }),
  shortCode: z.string().meta({ examples: ["OGN-202"] }),
  setId: z.string().meta({ examples: ["019cfc3b-0369-7890-a450-7859471cc3f6"] }),
  rarity: raritySchema,
  artVariant: artVariantSchema,
  isSigned: z.boolean().meta({ examples: [false] }),
  isOvernumbered: z.boolean().meta({ examples: [false] }),
  markers: z.array(markerSchema).meta({ examples: [[]] }),
  distributionChannels: z.array(printingDistributionChannelSchema).meta({ examples: [[]] }),
  // Key omitted entirely when the list is empty; read as `printing.citations ?? []`.
  citations: z
    .array(printingCitationSchema)
    .optional()
    .meta({ examples: [[]] }),
  finish: finishSchema,
  size: cardSizeSchema,
  // Absent when false; read it as `=== true`.
  hasFoilTwin: z
    .literal(true)
    .optional()
    .meta({ examples: [true] }),
  images: z.array(printingImageSchema),
  artist: z.string().meta({ examples: ["Kudos Productions"] }),
  publicCode: z.string().meta({ examples: ["OGN-202/298"] }),
  printedRulesText: z
    .string()
    .nullable()
    .meta({ examples: [null] }),
  printedEffectText: z
    .string()
    .nullable()
    .meta({ examples: [null] }),
  flavorText: z
    .string()
    .nullable()
    .meta({ examples: [null] }),
  printedName: z
    .string()
    .nullable()
    .meta({ examples: [null] }),
  printedYear: z
    .number()
    .int()
    .nullable()
    .meta({ examples: [2025] }),
  language: z.string().meta({ examples: ["EN"] }),
  comment: z
    .string()
    .nullable()
    .meta({ examples: [null] }),
  canonicalRank: z
    .number()
    .int()
    .meta({ examples: [1] }),
  // Omitted for the `auto` default; emitted only together with a servable
  // `fallbackImageId`, so a client never has to handle one without the other.
  fallbackArtMode: z
    .enum(["pinned", "none"])
    .optional()
    .meta({ examples: ["pinned"] }),
  fallbackImageId: z
    .string()
    .optional()
    .meta({ examples: ["019cfc3b-03d3-7dac-86c9-27900cd43727"] }),
  cardId: z.string().meta({ examples: ["019cfc3b-0389-744b-837c-792fd586300e"] }),
});

export const copyLinkSchema = z.object({
  url: z.url({ protocol: /^https?$/u }).max(500),
  label: z.string().min(1).max(100).optional(),
});

/** Renders on the public share page, so the host must be on the shared allowlist. */
export const deckLinkSchema = z.object({
  url: z
    .url({ protocol: /^https$/u })
    .max(500)
    .refine(isAllowedLinkUrl, "Links must point at a site we support"),
  title: z.string().min(1).max(60).optional(),
});

// `notesPrivate` is deliberately not part of this shape: it exists only on the
// authenticated schema and is stripped from every public surface.
export const copyMetadataResponseShape = {
  /** Ungraded condition slug (`conditions` reference table); null = unrecorded. */
  condition: z.string().nullable(),
  /** Grading company slug (`graders` reference table); set together with `grade`. */
  grader: z.string().nullable(),
  /** 1 to 10 in half steps; non-null exactly when `grader` is non-null. */
  grade: z.number().nullable(),
  notesPublic: z.string().nullable(),
  isAltered: z.boolean(),
  /** Ordered photo/video links. */
  links: z.array(copyLinkSchema),
};

export const copyResponseSchema = z.object({
  id: z.string(),
  printingId: z.string(),
  collectionId: z.string(),
  /** Owning group of the copy's collection, or null for personal collections. */
  groupId: z.string().nullable(),
  ...copyMetadataResponseShape,
  /** "Private" means stripped from public share surfaces only, not from group members. */
  notesPrivate: z.string().nullable(),
  /** Still owned, physically absent. */
  onLoan: z.boolean(),
  /** Still owned, but excluded from buildable deck stock while pinned to a trade. */
  reserved: z.boolean(),
});

export const copyListResponseSchema = z.object({
  items: z.array(copyResponseSchema),
  nextCursor: z.string().nullable(),
  deletedIds: z.array(z.uuid()).optional(),
  nextDeltaCursor: z.string().nullish(),
  syncedXid: z.string().optional(),
});

// Stays a concrete object (not z.record) so TanStack's server-fn type inference
// can propagate the response shape through the client hooks.
export const formatConfigResponseSchema = z
  .object({
    tagSlugs: z.array(z.string()).optional(),
  })
  .nullable()
  .meta({ examples: [{ tagSlugs: ["bilgewater", "neutral"] }] });

const deckMatchupSwapResponseSchema = z.object({
  cardId: z.string(),
  direction: z.enum(["in", "out"]),
  quantity: z.number(),
});

const deckMatchupPlanResponseSchema = z.object({
  id: z.string(),
  opponentCardId: z.string().nullable(),
  opponentLabel: z.string(),
  notes: z.string(),
  swaps: z.array(deckMatchupSwapResponseSchema),
});

export const deckPlanResponseSchema = z.object({
  generalStrategy: z.string(),
  mulliganSplit: z.boolean(),
  mulliganGeneral: z.string(),
  mulliganFirst: z.string(),
  mulliganSecond: z.string(),
  battlefieldGame1CardId: z.string().nullable(),
  battlefieldFirstCardId: z.string().nullable(),
  battlefieldSecondCardId: z.string().nullable(),
  battlefieldCustom: z.boolean(),
  battlefieldNote: z.string(),
  matchups: z.array(deckMatchupPlanResponseSchema),
});

export const tradePricePrefResponseSchema = z.enum([
  "cm_lowest",
  "tcg_lowest",
  "ct_zero",
  "absolute",
]);

export const tradeTypeResponseSchema = z.enum(["cards", "money", "both"]);

export const currencyResponseSchema = z.enum(["EUR", "USD"]);

export const tradePreferenceSchema = z.object({
  pricePref: tradePricePrefResponseSchema.nullable(),
  priceAbsoluteCents: z.number().int().positive().nullable(),
  tradeType: tradeTypeResponseSchema.nullable(),
});

// The DB CHECKs on `lists.intent` / `lists.kind` permit exactly these sets.
export const LIST_INTENTS = ["wish", "trade", "organize"] as const;
export const LIST_KINDS = ["card", "printing", "copy"] as const;

export const listIntentResponseSchema = z.enum(LIST_INTENTS);

export const listKindResponseSchema = z.enum(LIST_KINDS);

export const listEntryBaseShape = {
  id: z.string(),
  listId: z.string(),
  quantity: z.number(),
  tradeOverride: tradePreferenceSchema,
};

const listEntryDetailBaseShape = {
  ...listEntryBaseShape,
  // Rule-only entries have no `list_entries` row, so id is null and they
  // aren't individually editable — only excludable.
  id: z.string().nullable(),
  source: z.enum(["manual", "rule", "both"]),
  // Manual part of `quantity` is `quantity - ruleQuantity`.
  ruleQuantity: z.number(),
  cardName: z.string(),
};

const listEntryDetailPrintingFieldsShape = {
  setId: z.string(),
  rarity: raritySchema,
  finish: finishSchema,
  shortCode: z.string(),
  language: z.string(),
  imageId: imageIdSchema.nullable(),
};

export const listEntryDetailResponseSchema = z.discriminatedUnion("kind", [
  z.object({
    ...listEntryDetailBaseShape,
    kind: z.literal("card"),
    cardId: z.string(),
  }),
  z.object({
    ...listEntryDetailBaseShape,
    kind: z.literal("printing"),
    printingId: z.string(),
    ...listEntryDetailPrintingFieldsShape,
  }),
  z.object({
    ...listEntryDetailBaseShape,
    kind: z.literal("copy"),
    copyId: z.string(),
    printingId: z.string(),
    ...listEntryDetailPrintingFieldsShape,
    // Mid-trade: the tradelist shows a "Reserved" badge and blocks Sold.
    reserved: z.boolean(),
    // Physically absent: the tradelist shows an "On loan" badge and it never matches.
    onLoan: z.boolean(),
  }),
]);

export const publicListResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  intent: listIntentResponseSchema,
  kind: listKindResponseSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  tradeDefaults: tradePreferenceSchema,
  currency: currencyResponseSchema.nullable(),
});

export const publicListDetailResponseSchema = z.object({
  list: publicListResponseSchema,
  entries: z.array(listEntryDetailResponseSchema),
  owner: z.object({ displayName: z.string(), gravatarHash: z.string().nullable() }),
});

export const contactMethodSchema = z.object({
  id: z.string(),
  type: z.enum([
    "discord",
    "signal",
    "telegram",
    "whatsapp",
    "phone",
    "email",
    "in_person",
    "other",
  ]),
  value: z.string(),
});

/** The DB CHECK on `tournaments.status` permits exactly this set. */
export const TOURNAMENT_STATUSES = ["setup", "running", "completed", "cancelled"] as const;

// The pod engine reads the same `tournaments.status` column, kept as its own
// OpenAPI component because the pod response schemas reference it by that name.
export const podTournamentStatusSchema = z.enum(TOURNAMENT_STATUSES);
export const podScoringSchemeSchema = z.enum(["standard", "three_pod_reduced"]);
export const podPlayerStatusSchema = z.enum(["active", "dropped"]);
export const podPairingStyleSchema = z.enum(["none", "pod", "swiss"]);
export const podMatchFormatSchema = z.enum(["bo1", "bo3"]);
export const podPlayModeSchema = z.enum(["1v1", "2v2"]);

export const podStandingRowSchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  status: podPlayerStatusSchema,
  droppedAfterRound: z.number().int().nullable(),
  /** The player's fixed 2v2 team, or null (always null in 1v1 play). */
  teamId: z.string().nullable(),
  score: z.number(),
  gamePoints: z.number().nonnegative(),
  roundsPlayed: z.number().int().nonnegative(),
  pods3Count: z.number().int().nonnegative(),
  pods4Count: z.number().int().nonnegative(),
  byeCount: z.number().int().nonnegative(),
  podWins: z.number().int().nonnegative(),
  // Swiss match record; all zero for pod-style tournaments.
  wins: z.number().int().nonnegative(),
  draws: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  region: z.string().nullable(),
  avgOpponentScore: z.number(),
  avgOpponentGamePoints: z.number(),
});

export const podMemberResponseSchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  /** The member's fixed 2v2 team, for side grouping; null in 1v1 play. */
  teamId: z.string().nullable(),
  gamePoints: z.number().int().nullable(),
  placement: z.number().int().nullable(),
  points: z.number().nullable(),
});

export const podPenaltyViewSchema = z.object({
  total: z.number(),
  rematchPairs: z.number().int().nonnegative(),
  spread: z.number(),
  scoreSpread: z.number(),
  imbalance: z.number(),
  float: z.number(),
  threePodRepeat: z.number(),
  sameRegion: z.number(),
  repeatedRegion: z.number(),
});

export const podResultStatusSchema = z.enum(["pending", "reported"]);
export const podRoundStatusSchema = z.enum(["reporting", "finalized"]);

export const podResponseSchema = z.object({
  id: z.string(),
  podNumber: z.number().int().positive(),
  size: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  resultStatus: podResultStatusSchema,
  members: z.array(podMemberResponseSchema),
  penalty: podPenaltyViewSchema.nullable(),
});

export const podByeResponseSchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
});

export const podRoundResponseSchema = z.object({
  id: z.string(),
  roundNumber: z.number().int().positive(),
  status: podRoundStatusSchema,
  pairingStrategy: z.string().nullable(),
  penaltyTotal: z.number().nullable(),
  createdAt: z.string(),
  finalizedAt: z.string().nullable(),
  pods: z.array(podResponseSchema),
  byes: z.array(podByeResponseSchema),
});

export const podReportTokenResponseSchema = z.object({ reportToken: z.string().nullable() });

export const TOURNAMENT_FORMATS = ["rounds", "group_cut"] as const;
export const tournamentFormatSchema = z.enum(TOURNAMENT_FORMATS);
export const cutSizeSchema = z.union([z.literal(4), z.literal(8), z.literal(16)]);
export const groupCutTierSchema = z.enum(GROUP_CUT_TIERS);

export const groupCutSettingsShape = {
  format: tournamentFormatSchema,
  cutSize: cutSizeSchema,
  cutRematchAvoidance: z.boolean(),
  legendTiebreak: z.boolean(),
  groupsSelfPaced: z.boolean(),
};

export const podTournamentResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: podTournamentStatusSchema,
  currentRound: z.number().int().nonnegative(),
  pairingStyle: podPairingStyleSchema,
  playMode: podPlayModeSchema,
  scoringScheme: podScoringSchemeSchema,
  byePoints: z.number().int().nonnegative(),
  matchFormat: podMatchFormatSchema,
  winPoints: z.number().int().nonnegative(),
  drawPoints: z.number().int().nonnegative(),
  regionsEnabled: z.boolean(),
  ...groupCutSettingsShape,
  reportToken: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const groupStandingRowSchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  status: podPlayerStatusSchema,
  legendCardId: z.string().nullable(),
  legendName: z.string().nullable(),
  place: z.number().int().positive(),
  points: z.number(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  draws: z.number().int().nonnegative(),
  gamesWon: z.number().int().nonnegative(),
  gamesPlayed: z.number().int().nonnegative(),
  gameWinRate: z.number().nullable(),
  decidedBy: groupCutTierSchema.nullable(),
});

export const groupStageGroupSchema = z.object({
  id: z.string(),
  label: z.string(),
  pairedGroupId: z.string().nullable(),
  pairedGroupLabel: z.string().nullable(),
  /** Slot order. */
  playerIds: z.array(z.string()),
  /** Group-stage rounds this group has started, 0 to 3. */
  roundsStarted: z.number().int().min(0).max(3),
  currentRoundReported: z.boolean(),
  canStartNextRound: z.boolean(),
  done: z.boolean(),
  standings: z.array(groupStandingRowSchema),
});

export const groupQualificationRowSchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  groupLabel: z.string(),
  place: z.number().int().positive(),
  matchWinRate: z.number(),
  gameWinRate: z.number().nullable(),
  /** Players in the field on the same Legend; null without a Legend or with the tiers off. */
  legendCount: z.number().int().nonnegative().nullable(),
  metaShare: z.number().nullable(),
  decidedBy: groupCutTierSchema.nullable(),
  /** Locked seed once the cut exists, else the provisional seed or null past the cut size. */
  seed: z.number().int().positive().nullable(),
  qualified: z.boolean(),
});

export const finalStandingRowSchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  place: z.number().int().positive(),
  seed: z.number().int().positive().nullable(),
  groupLabel: z.string(),
  groupPlace: z.number().int().positive(),
  /** The cut round the player lost in; null for the champion and for players who missed the cut. */
  exitRound: z.number().int().positive().nullable(),
});

export const legendMetaShareSchema = z.object({
  legendCardId: z.string(),
  legendName: z.string().nullable(),
  /** Percent. */
  share: z.number().min(0).max(100),
});

export const groupStageViewSchema = z.object({
  groups: z.array(groupStageGroupSchema),
  ranking: z.array(groupQualificationRowSchema),
  pendingMetaShares: z.array(
    z.object({ legendCardId: z.string(), legendName: z.string().nullable() }),
  ),
  stageComplete: z.boolean(),
  cutGenerated: z.boolean(),
  /** Seeds are locked but the derived ranking no longer agrees with them. */
  seedsDiverged: z.boolean(),
  /** Null until the final has a winner. */
  finalStandings: z.array(finalStandingRowSchema).nullable(),
});

export const podStandingsSnapshotSchema = z.object({
  /** The last round folded in; 0 while nothing is finalized. */
  throughRound: z.number().int().nonnegative(),
  /** Highest finalized round number, so a viewer of an older snapshot can jump to the latest. */
  latestRound: z.number().int().nonnegative(),
  standings: z.array(podStandingRowSchema),
  /** The rounds up to `throughRound`. */
  rounds: z.array(podRoundResponseSchema),
  /** Null unless the format is `group_cut`; derived from the rounds up to `throughRound`. */
  groupStage: groupStageViewSchema.nullable(),
});

export const podPlayerResponseSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  status: podPlayerStatusSchema,
  droppedAfterRound: z.number().int().nullable(),
  /** The player's fixed 2v2 team, or null (always null in 1v1 play). */
  teamId: z.string().nullable(),
  legendCardId: z.string().nullable(),
  createdAt: z.string(),
});

export const podSnapshotPlayerSchema = z.object({
  playerId: z.string(),
  /** The player's fixed 2v2 team, or null (always null in 1v1 play). */
  teamId: z.string().nullable(),
  score: z.number(),
  pods3: z.number().int().nonnegative(),
  pods4: z.number().int().nonnegative(),
  byes: z.number().int().nonnegative(),
  opponents: z.record(z.string(), z.number().int().nonnegative()),
  region: z.string().nullable(),
  /** Opponent region slug -> times faced across finalized rounds. */
  regionHistory: z.record(z.string(), z.number().int().nonnegative()),
  /** Fixed (physical) table number, or null; steers table assignment only. */
  fixedTable: z.number().int().nullable(),
});

export const podTournamentDetailResponseSchema = z.object({
  tournament: podTournamentResponseSchema,
  players: z.array(podPlayerResponseSchema),
  standings: z.array(podStandingRowSchema),
  rounds: z.array(podRoundResponseSchema),
  openRoundSnapshot: z.array(podSnapshotPlayerSchema).nullable(),
  /** Null unless `format` is `group_cut`. */
  groupStage: groupStageViewSchema.nullable(),
  /** Organizer-entered values; only the staff dialog shows them. */
  legendMetaShares: z.array(legendMetaShareSchema),
});

export const deckCheckEntryStateSchema = z.enum([
  "editable",
  "submitted",
  "approved",
  "checked",
  "withdrawn",
]);
export const deckCheckReviewOutcomeSchema = z.enum(["ok", "issue"]);
export const deckCheckMatchStatusSchema = z.enum(["matched", "ambiguous", "unmatched"]);

export const deckCheckEntryCardResponseSchema = z.object({
  id: z.string(),
  sortOrder: z.number().int().nonnegative(),
  rawName: z.string(),
  section: z.string(),
  zone: deckZoneSchema,
  quantity: z.number().int().positive(),
  matchStatus: deckCheckMatchStatusSchema,
  foundCopies: z.array(z.boolean()),
  resolvedCardId: z.string().nullable(),
  resolvedPrintingId: z.string().nullable(),
});

export const deckViolationSchema = z.object({
  // Every deck zone, plus "deck" for whole-deck-scope violations (not a zone).
  zone: z.enum([...DECK_ZONE_VALUES, "deck"]),
  code: z.string(),
  message: z.string(),
  cardId: z.string().optional(),
});

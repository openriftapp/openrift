import type { DismissedValue } from "@openrift/shared/contracts/admin/card-detail-schemas";
import type {
  CardSubmissionKind,
  CardSubmissionReason,
  CardSubmissionStatus,
} from "@openrift/shared/contracts/card-submissions";
import type { ColumnType, Generated } from "kysely";

import type { CreatedAt, UpdatedAt } from "./columns.js";

type DismissedValues = Record<string, DismissedValue>;

export interface CandidateCardsTable {
  id: Generated<string>;
  provider: string;
  name: string;
  normName: Generated<string>;
  types: Generated<string[]>;
  superTypes: Generated<string[]>;
  domains: string[];
  might: number | null;
  energy: number | null;
  power: number | null;
  mightBonus: number | null;
  rulesText: string | null;
  effectText: string | null;
  tags: Generated<string[]>;
  shortCode: string | null;
  externalId: string;
  extraData: unknown | null;
  submittedByUserId: string | null;
  submissionNote: string | null;
  checkedAt: ColumnType<Date | null, Date | null | undefined, Date | null>;
  dismissedValues: ColumnType<DismissedValues, DismissedValues | undefined, DismissedValues>;
  uploadedAt: ColumnType<Date, Date | undefined, Date>;
  createdAt: CreatedAt;
  updatedAt: UpdatedAt;
}

export interface CandidatePrintingsTable {
  id: Generated<string>;
  candidateCardId: string;
  printingId: string | null;
  shortCode: string;
  setId: string | null;
  setName: string | null;
  rarity: string | null;
  artVariant: string | null;
  isSigned: boolean | null;
  isOvernumbered: boolean | null;
  markerSlugs: Generated<string[]>;
  distributionChannelSlugs: Generated<string[]>;
  finish: string | null;
  size: string | null;
  artist: string | null;
  publicCode: string | null;
  printedRulesText: string | null;
  printedEffectText: string | null;
  imageUrl: string | null;
  imageFingerprint: string | null;
  imageFingerprintUrl: string | null;
  flavorText: string | null;
  externalId: string;
  extraData: unknown | null;

  language: string | null;
  printedName: string | null;
  printedYear: number | null;
  releasedAt: string | null;
  releasePrecision: "day" | "month" | "quarter" | "year" | null;
  announcedAt: string | null;

  checkedAt: ColumnType<Date | null, Date | null | undefined, Date | null>;
  dismissedValues: ColumnType<DismissedValues, DismissedValues | undefined, DismissedValues>;
  uploadedAt: ColumnType<Date, Date | undefined, Date>;
  createdAt: CreatedAt;
  updatedAt: UpdatedAt;
}

export interface IgnoredCandidateCardsTable {
  id: Generated<string>;
  provider: string;
  externalId: string;
  createdAt: CreatedAt;
}

export interface CandidateFingerprintFailuresTable {
  candidatePrintingId: string;
  imageUrl: string;
  attempts: number;
  lastError: string;
  lastAttemptAt: Generated<Date>;
}

export interface IgnoredCandidatePrintingsTable {
  id: Generated<string>;
  provider: string;
  externalId: string;
  finish: string | null;
  createdAt: CreatedAt;
}

export interface CardSubmissionsTable {
  id: Generated<string>;
  userId: string;
  provider: string;
  externalId: string;
  candidateCardId: string | null;
  kind: CardSubmissionKind;
  cardName: string;
  cardSlug: string | null;
  note: string | null;
  proposedDiff: ColumnType<string[], string[] | undefined, string[]>;
  status: ColumnType<CardSubmissionStatus, CardSubmissionStatus | undefined, CardSubmissionStatus>;
  resolutionReason: CardSubmissionReason | null;
  resolutionNote: string | null;
  resolvedAt: ColumnType<Date | null, Date | null | undefined, Date | null>;
  resolvedByUserId: string | null;
  acceptedCardId: string | null;
  createdAt: CreatedAt;
  updatedAt: UpdatedAt;
}

export interface PrintingLinkOverridesTable {
  externalId: string;
  finish: string;
  provider: string;
  printingId: string;
  createdAt: CreatedAt;
}

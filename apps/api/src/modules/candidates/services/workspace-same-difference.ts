import {
  COMPARABLE_CARD_FIELDS,
  differingFields,
  sameFieldValue,
} from "@openrift/shared/catalog-field-compare";
import type {
  WorkspaceDiscardSameDifferenceResponse,
  WorkspaceSameDifferenceInput,
  WorkspaceSameDifferenceResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace-bulk";
import { ERROR_CODES } from "@openrift/shared/error-codes";

import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import type { AdminAccess } from "../../../middleware/require-admin.js";
import { assertProvidersInScope, reviewableProviderScope } from "../lib/card-review-scope.js";
import type { WorkspaceCardDifferenceRow } from "../repositories/workspace-queue.js";

const LISTED_CARDS = 20;

type SameDifferenceRepos = Pick<Repos, "workspaceQueue" | "providerSettings">;

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AppError(400, ERROR_CODES.BAD_REQUEST, "Invalid value");
  }
}

export function matchSameDifference(
  rows: readonly WorkspaceCardDifferenceRow[],
  input: WorkspaceSameDifferenceInput,
): WorkspaceCardDifferenceRow[] {
  const value = parseValue(input.value);
  const current = input.currentValue === undefined ? undefined : parseValue(input.currentValue);
  return rows
    .filter((row) => {
      if (row.provider !== input.provider) {
        return false;
      }
      const candidate = row.candidate as unknown as Record<string, unknown>;
      const live = row.live as unknown as Record<string, unknown>;
      return (
        differingFields(COMPARABLE_CARD_FIELDS, row.live, row.candidate).includes(input.field) &&
        sameFieldValue(candidate[input.field], value, input.field) &&
        (current === undefined || sameFieldValue(live[input.field] ?? null, current, input.field))
      );
    })
    .toSorted((a, b) => a.cardSlug.localeCompare(b.cardSlug));
}

async function assertInScope(
  repos: Pick<Repos, "providerSettings">,
  access: AdminAccess | null,
  provider: string,
): Promise<void> {
  const scope = await reviewableProviderScope(access, repos.providerSettings);
  assertProvidersInScope([provider], scope);
}

export async function findSameDifference(
  repos: SameDifferenceRepos,
  options: { access: AdminAccess | null; input: WorkspaceSameDifferenceInput },
): Promise<WorkspaceSameDifferenceResponse> {
  await assertInScope(repos, options.access, options.input.provider);
  const matches = matchSameDifference(
    await repos.workspaceQueue.uncheckedCardDifferences(),
    options.input,
  );
  return {
    count: matches.length,
    candidateCardIds: matches.map((row) => row.id),
    cards: matches
      .slice(0, LISTED_CARDS)
      .map((row) => ({ slug: row.cardSlug, name: row.cardName })),
  };
}

export async function discardSameDifference(
  transact: Transact,
  repos: SameDifferenceRepos,
  options: {
    access: AdminAccess | null;
    userId: string;
    input: WorkspaceSameDifferenceInput;
    now: Date;
  },
): Promise<WorkspaceDiscardSameDifferenceResponse> {
  const { input, now } = options;
  await assertInScope(repos, options.access, input.provider);
  return transact(async (trx) => {
    const matches = matchSameDifference(await trx.workspaceQueue.uncheckedCardDifferences(), input);
    const ids = matches.map((row) => row.id);
    const checked = await trx.candidateCards.checkCandidateCardsByIds(ids, now);
    for (const row of matches) {
      // oxlint-disable-next-line no-await-in-loop -- sequential writes on one transaction connection
      await trx.adminEvents.insert({
        actorUserId: options.userId,
        action: "candidate-card.discard-same-difference",
        entityType: "candidate-card",
        entityId: row.id,
        entityLabel: row.cardName,
        cardSlug: row.cardSlug,
        newValues: { provider: input.provider, field: input.field, value: input.value },
      });
    }
    return { checked, candidateCardIds: ids };
  });
}

import type {
  OverlayBoard,
  OverlayChannelResponse,
  OverlayPayload,
} from "@openrift/shared/contracts/overlay";
import { overlayContract } from "@openrift/shared/contracts/overlay";
import { implement } from "@orpc/server";

import type { Repos } from "../../../deps.js";
import { assertFound } from "../../../lib/assertions.js";
import { isUniqueViolationOn } from "../../../lib/pg-errors.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { applyOverlaySettings, toOverlayChannel } from "../lib/overlay-presenters.js";
import type { OverlayChannel } from "../repositories/overlay-channels.js";

const os = implement(overlayContract).$context<ApiContext>().use(requireAuthedUser);

/**
 * Returns the user's channel, creating it on first ask.
 */
async function ensureChannel(repos: Repos, userId: string): Promise<OverlayChannel> {
  const existing = await repos.overlayChannels.getByUserId(userId);
  if (existing) {
    return existing;
  }
  try {
    return await repos.overlayChannels.create(userId);
  } catch (error) {
    // Two first-opens can race on the user_id unique; the winner's row is returned.
    if (isUniqueViolationOn(error, "overlay_channels_user_id_key")) {
      const winner = await repos.overlayChannels.getByUserId(userId);
      if (winner) {
        return winner;
      }
    }
    throw error;
  }
}

/**
 * Clamps revealCount to [0, total]. An unclamped overshoot would make a later
 * Prev press start counting down from a position the board never had.
 */
function clampReveal(board: OverlayBoard, revealCount: number): number {
  const total = board.tiers.reduce((sum, row) => sum + row.cards.length, 0);
  return Math.min(Math.max(revealCount, 0), total);
}

async function updatePayload(
  context: ApiContext & { userId: string },
  build: (payload: OverlayPayload) => OverlayPayload | null,
): Promise<OverlayChannelResponse> {
  await ensureChannel(context.repos, context.userId);
  return context.transact(async (trxRepos) => {
    const channel = await trxRepos.overlayChannels.getByUserId(context.userId, {
      forUpdate: true,
    });
    assertFound(channel, "Overlay channel not found");
    const payload = build(channel.payload);
    if (!payload) {
      return toOverlayChannel(channel);
    }
    const updated = await trxRepos.overlayChannels.setPayload(context.userId, payload);
    return toOverlayChannel(updated ?? channel);
  });
}

/** Fields the caller doesn't send stay unchanged. */
export const overlayRouter = {
  get: os.get.handler(async ({ context }): Promise<OverlayChannelResponse> =>
    toOverlayChannel(await ensureChannel(context.repos, context.userId)),
  ),

  push: os.push.handler(({ context, input }): Promise<OverlayChannelResponse> =>
    updatePayload(context, (payload) => ({
      ...applyOverlaySettings(payload, input),
      printingId: input.printingId,
      // Pushing a card clears the board: only one occupies the corner at a time.
      board: null,
    })),
  ),

  pushBoard: os.pushBoard.handler(({ context, input }): Promise<OverlayChannelResponse> =>
    updatePayload(context, (payload) => ({
      ...payload,
      printingId: null,
      board: { ...input.board, revealCount: clampReveal(input.board, input.board.revealCount) },
    })),
  ),

  setBoardReveal: os.setBoardReveal.handler(({ context, input }): Promise<OverlayChannelResponse> =>
    updatePayload(context, (payload) => {
      const board = payload.board;
      // No board to step: a stale reveal control returns the channel unchanged.
      if (!board) {
        return null;
      }
      return {
        ...payload,
        board: { ...board, revealCount: clampReveal(board, input.revealCount) },
      };
    }),
  ),

  // Hidden only toggles visibility; the underlying card/board stays set.
  setHidden: os.setHidden.handler(({ context, input }): Promise<OverlayChannelResponse> =>
    updatePayload(context, (payload) => ({ ...payload, hidden: input.hidden })),
  ),

  // Clears card/board/hidden but leaves dressing (corner, scale, plate, QR)
  // untouched; hidden must reset too or the next segment's first push lands unseen.
  clear: os.clear.handler(({ context }): Promise<OverlayChannelResponse> =>
    updatePayload(context, (payload) => ({
      ...payload,
      printingId: null,
      board: null,
      hidden: false,
    })),
  ),

  updateSettings: os.updateSettings.handler(({ context, input }): Promise<OverlayChannelResponse> =>
    updatePayload(context, (payload) => applyOverlaySettings(payload, input)),
  ),

  enableToken: os.enableToken.handler(async ({ context }): Promise<OverlayChannelResponse> => {
    const channel = await ensureChannel(context.repos, context.userId);
    const updated = await context.repos.overlayChannels.enableToken(context.userId);
    return toOverlayChannel(updated ?? channel);
  }),

  disableToken: os.disableToken.handler(async ({ context }): Promise<OverlayChannelResponse> => {
    const channel = await ensureChannel(context.repos, context.userId);
    const updated = await context.repos.overlayChannels.disableToken(context.userId);
    return toOverlayChannel(updated ?? channel);
  }),
};

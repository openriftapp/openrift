import { cardmarketOverlayContract } from "@openrift/shared/contracts/cardmarket-overlay";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { overlayWantsFromEntries } from "../lib/cardmarket-overlay-wants.js";

const os = implement(cardmarketOverlayContract).$context<ApiContext>().use(requireAuthedUser);

export const cardmarketOverlayRouter = {
  snapshot: os.snapshot.handler(async ({ input, context, errors }) => {
    const requested = [...new Set(input.listIds)];
    const lists = await context.repos.cardmarketOverlay.wishListsForUser(requested, context.userId);
    if (lists.length !== requested.length) {
      throw errors.NOT_FOUND({ message: "List not found" });
    }

    // A rule-driven list has no `list_entries` rows; this is what expands it.
    const entriesPerList = await Promise.all(
      lists.map((list) =>
        context.repos.lists.entriesWithDetails(list.id, list.kind, context.userId),
      ),
    );
    const wants = entriesPerList.flatMap((entries) => overlayWantsFromEntries(entries));

    const products = await context.repos.cardmarketOverlay.productCounts(
      wants,
      context.userId,
      input.marketplace,
    );
    return {
      lists: lists.map((list) => ({ id: list.id, name: list.name })),
      marketplace: input.marketplace,
      generatedAt: new Date().toISOString(),
      products,
    };
  }),
};

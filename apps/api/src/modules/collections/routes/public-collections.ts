import { publicCollectionsContract } from "@openrift/shared/contracts/public-collections";
import type { PublicCollectionDetailResponse } from "@openrift/shared/types/api/collection";
import { implement } from "@orpc/server";

import { keysetPage } from "../../../lib/keyset-cursor.js";
import { toShareOwner } from "../../../lib/share-owner.js";
import { requireUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { getFavoriteMarketplace } from "../../users/lib/preferences.js";
import { toPublicCollection } from "../lib/collection-presenters.js";
import { clampCopiesLimit } from "../lib/copies-page-limit.js";
import { toPublicCopy } from "../lib/copy-presenters.js";

const os = implement(publicCollectionsContract).$context<ApiContext>().use(requireUser);

export const publicCollectionsRouter = {
  share: os.share.handler(
    async ({ input, context, errors }): Promise<PublicCollectionDetailResponse> => {
      const repos = context.repos;
      const { collections, copies, marketplace } = repos;

      const found = await collections.getByShareToken(input.token);
      if (!found) {
        throw errors.NOT_FOUND({ message: "Not found" });
      }

      const favMarketplace = await getFavoriteMarketplace(repos, found.collection.userId);
      const value = await marketplace.singleCollectionValue(found.collection.id, favMarketplace);

      const effectiveLimit = clampCopiesLimit(input.limit);
      const rows = await copies.listForCollection(
        found.collection.id,
        effectiveLimit,
        input.cursor,
      );
      const { items, nextCursor } = keysetPage(rows, effectiveLimit, toPublicCopy);

      return {
        collection: toPublicCollection(found.collection, value),
        items,
        nextCursor,
        owner: toShareOwner({ displayName: found.ownerName, email: found.ownerEmail }),
      };
    },
  ),
};
